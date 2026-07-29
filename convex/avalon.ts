import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  TEAM_COUNTS, QUEST_SIZES, DOUBLE_FAIL_QUEST,
  ROLE_TEAM, buildRoles, knownNames, Role,
} from "./logic";
import { THEMES } from "./themes";

/* ------------------------------- helpers ------------------------------- */
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const makeCode = () =>
  Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join("");

async function roomByCode(ctx: MutationCtx, code: string) {
  return ctx.db
    .query("rooms")
    .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
    .unique();
}

async function playersOf(ctx: MutationCtx, roomId: Id<"rooms">) {
  const list = await ctx.db
    .query("players")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
  return list.sort((a, b) => a.seat - b.seat);
}

async function clearSubmissions(ctx: MutationCtx, roomId: Id<"rooms">) {
  const votes = await ctx.db
    .query("votes")
    .withIndex("by_room_round", (q) => q.eq("roomId", roomId))
    .collect();
  for (const v0 of votes) await ctx.db.delete(v0._id);
  const cards = await ctx.db
    .query("questCards")
    .withIndex("by_room_quest", (q) => q.eq("roomId", roomId))
    .collect();
  for (const c of cards) await ctx.db.delete(c._id);
}

function requireRoom<T>(r: T | null): T {
  if (!r) throw new Error("Room not found.");
  return r;
}

/* ----------------------------- resolution ------------------------------ */
async function resolveVotes(
  ctx: MutationCtx,
  room: Doc<"rooms">,
  players: Doc<"players">[],
) {
  const votes = await ctx.db
    .query("votes")
    .withIndex("by_room_round", (q) =>
      q.eq("roomId", room._id).eq("roundId", room.roundId))
    .collect();
  const approvers = votes.filter((x) => x.choice === "approve").map((x) => x.playerId);
  const rejecters = votes.filter((x) => x.choice === "reject").map((x) => x.playerId);
  const approved = approvers.length > rejecters.length;
  const n = players.length;
  const lastVote = {
    roundId: room.roundId, approved, approvers, rejecters, team: room.proposedTeam,
  };

  if (approved) {
    await ctx.db.patch(room._id, { phase: "quest", rejectCount: 0, lastVote });
  } else {
    const rc = room.rejectCount + 1;
    if (rc >= 5) {
      const theme = THEMES[room.themeId ?? "india"] ?? THEMES.india;
      await ctx.db.patch(room._id, {
        phase: "end", winner: "evil",
        winReason: theme.winReasons.fiveRejections,
        lastVote,
      });
    } else {
      await ctx.db.patch(room._id, {
        phase: "propose", rejectCount: rc,
        leaderIndex: (room.leaderIndex + 1) % n,
        roundId: room.roundId + 1, proposedTeam: [], lastVote,
      });
    }
  }
}

async function resolveQuest(
  ctx: MutationCtx,
  room: Doc<"rooms">,
  players: Doc<"players">[],
) {
  const cards = await ctx.db
    .query("questCards")
    .withIndex("by_room_quest", (q) =>
      q.eq("roomId", room._id).eq("questIndex", room.questIndex))
    .collect();
  const n = players.length;
  const fails = cards.filter((c) => c.card === "fail").length;
  const needed = room.questIndex === DOUBLE_FAIL_QUEST && n >= 7 ? 2 : 1;
  const success = fails < needed;

  const results = [...room.questResults];
  results[room.questIndex] = success ? "success" : "fail";
  const successes = results.filter((x) => x === "success").length;
  const failures = results.filter((x) => x === "fail").length;
  const lastQuest = {
    questIndex: room.questIndex, fails, success, size: room.proposedTeam.length,
  };

  if (failures >= 3) {
    const theme = THEMES[room.themeId ?? "india"] ?? THEMES.india;
    await ctx.db.patch(room._id, {
      phase: "end", winner: "evil", questResults: results, lastQuest,
      winReason: theme.winReasons.threeFails,
    });
  } else if (successes >= 3) {
    await ctx.db.patch(room._id, { phase: "assassin", questResults: results, lastQuest });
  } else {
    await ctx.db.patch(room._id, {
      phase: "propose", questResults: results, lastQuest,
      questIndex: room.questIndex + 1,
      leaderIndex: (room.leaderIndex + 1) % n,
      roundId: room.roundId + 1, rejectCount: 0, proposedTeam: [],
    });
  }
}

/* ------------------------------ mutations ------------------------------ */
export const createRoom = mutation({
  args: {
    playerId: v.string(),
    name: v.string(),
    themeId: v.optional(v.string()),
    opts: v.object({
      percival: v.boolean(), morgana: v.boolean(),
      mordred: v.boolean(), oberon: v.boolean(),
    }),
  },
  handler: async (ctx, { playerId, name, themeId, opts }) => {
    let code = makeCode();
    for (let i = 0; i < 6 && (await roomByCode(ctx, code)); i++) code = makeCode();
    const roomId = await ctx.db.insert("rooms", {
      code,
      themeId: themeId ?? "india",
      hostId: playerId,
      phase: "lobby",
      leaderIndex: 0,
      roundId: 0,
      questIndex: 0,
      questResults: [null, null, null, null, null],
      rejectCount: 0,
      proposedTeam: [],
      opts,
    });
    await ctx.db.insert("players", { roomId, playerId, name: name.trim(), seat: 0 });
    return { code };
  },
});

export const joinRoom = mutation({
  args: { code: v.string(), playerId: v.string(), name: v.string() },
  handler: async (ctx, { code, playerId, name }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    const players = await playersOf(ctx, room._id);

    // Reclaim a seat by name (e.g. after a refresh): adopt the existing identity.
    const existing = players.find(
      (p) => p.name.toLowerCase() === name.trim().toLowerCase());
    if (existing) return { code: room.code, playerId: existing.playerId };

    if (room.phase !== "lobby") throw new Error("That game has already started.");
    if (players.length >= 10) throw new Error("Room is full (10 max).");
    await ctx.db.insert("players", {
      roomId: room._id, playerId, name: name.trim(), seat: players.length,
    });
    return { code: room.code, playerId };
  },
});

export const leaveRoom = mutation({
  args: { code: v.string(), playerId: v.string() },
  handler: async (ctx, { code, playerId }) => {
    const room = await roomByCode(ctx, code);
    if (!room || room.phase !== "lobby") return;
    const players = await playersOf(ctx, room._id);
    const me = players.find((p) => p.playerId === playerId);
    if (me) await ctx.db.delete(me._id);

    const rest = players.filter((p) => p.playerId !== playerId);
    if (rest.length === 0) {
      await ctx.db.delete(room._id);
      return;
    }
    // reindex seats and reassign host if needed
    for (let i = 0; i < rest.length; i++) {
      if (rest[i].seat !== i) await ctx.db.patch(rest[i]._id, { seat: i });
    }
    if (room.hostId === playerId) {
      await ctx.db.patch(room._id, { hostId: rest[0].playerId });
    }
  },
});

export const setOpts = mutation({
  args: {
    code: v.string(), playerId: v.string(),
    opts: v.object({
      percival: v.boolean(), morgana: v.boolean(),
      mordred: v.boolean(), oberon: v.boolean(),
    }),
  },
  handler: async (ctx, { code, playerId, opts }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.hostId !== playerId) throw new Error("Only the host can change roles.");
    if (room.phase !== "lobby") return;
    await ctx.db.patch(room._id, { opts });
  },
});

export const changeTheme = mutation({
  args: {
    code: v.string(),
    playerId: v.string(),
    themeId: v.string(),
  },
  handler: async (ctx, { code, playerId, themeId }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.hostId !== playerId) throw new Error("Only the host can change themes.");
    if (room.phase !== "lobby") throw new Error("Cannot change theme after game started.");
    if (!THEMES[themeId]) throw new Error(`Theme ${themeId} not found.`);
    await ctx.db.patch(room._id, { themeId });
  },
});

export const startGame = mutation({
  args: { code: v.string(), playerId: v.string() },
  handler: async (ctx, { code, playerId }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.hostId !== playerId) throw new Error("Only the host can start.");
    const players = await playersOf(ctx, room._id);
    if (players.length < 5) throw new Error("Need at least 5 players.");

    await clearSubmissions(ctx, room._id);
    const roles = buildRoles(players.map((p) => p.playerId), room.opts);
    for (const p of players) await ctx.db.patch(p._id, { role: roles[p.playerId] });

    await ctx.db.patch(room._id, {
      phase: "reveal",
      leaderIndex: Math.floor(Math.random() * players.length),
      roundId: 1, questIndex: 0,
      questResults: [null, null, null, null, null],
      rejectCount: 0, proposedTeam: [],
      lastVote: undefined, lastQuest: undefined,
      winner: undefined, winReason: undefined, assassinGuess: undefined,
    });
  },
});

export const beginQuests = mutation({
  args: { code: v.string(), playerId: v.string() },
  handler: async (ctx, { code, playerId }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.hostId !== playerId) throw new Error("Only the host can begin.");
    if (room.phase === "reveal") await ctx.db.patch(room._id, { phase: "propose" });
  },
});

export const proposeTeam = mutation({
  args: { code: v.string(), playerId: v.string(), team: v.array(v.string()) },
  handler: async (ctx, { code, playerId, team }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.phase !== "propose") throw new Error("Not the proposal phase.");
    const players = await playersOf(ctx, room._id);
    const leader = players[room.leaderIndex];
    if (leader.playerId !== playerId) throw new Error("Only the leader proposes.");
    const size = QUEST_SIZES[players.length][room.questIndex];
    if (team.length !== size) throw new Error(`Party must be ${size} knights.`);
    await ctx.db.patch(room._id, { phase: "vote", proposedTeam: team });
  },
});

export const castVote = mutation({
  args: {
    code: v.string(), playerId: v.string(),
    choice: v.union(v.literal("approve"), v.literal("reject")),
  },
  handler: async (ctx, { code, playerId, choice }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.phase !== "vote") throw new Error("Not voting right now.");
    const players = await playersOf(ctx, room._id);
    if (!players.some((p) => p.playerId === playerId)) throw new Error("Not in this room.");

    const existing = (
      await ctx.db.query("votes")
        .withIndex("by_room_round", (q) =>
          q.eq("roomId", room._id).eq("roundId", room.roundId))
        .collect()
    ).find((x) => x.playerId === playerId);

    if (existing) await ctx.db.patch(existing._id, { choice });
    else await ctx.db.insert("votes", {
      roomId: room._id, roundId: room.roundId, playerId, choice,
    });

    const votes = await ctx.db.query("votes")
      .withIndex("by_room_round", (q) =>
        q.eq("roomId", room._id).eq("roundId", room.roundId))
      .collect();
    if (votes.length >= players.length) await resolveVotes(ctx, room, players);
  },
});

export const playQuestCard = mutation({
  args: {
    code: v.string(), playerId: v.string(),
    card: v.union(v.literal("success"), v.literal("fail")),
  },
  handler: async (ctx, { code, playerId, card }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.phase !== "quest") throw new Error("No quest underway.");
    if (!room.proposedTeam.includes(playerId)) throw new Error("You are not on this quest.");
    const players = await playersOf(ctx, room._id);
    const me = players.find((p) => p.playerId === playerId)!;
    // Server enforces secrecy rule: loyal servants of Arthur may only succeed.
    const finalCard = me.role && ROLE_TEAM[me.role as Role] === "evil" ? card : "success";

    const existing = (
      await ctx.db.query("questCards")
        .withIndex("by_room_quest", (q) =>
          q.eq("roomId", room._id).eq("questIndex", room.questIndex))
        .collect()
    ).find((x) => x.playerId === playerId);

    if (existing) await ctx.db.patch(existing._id, { card: finalCard });
    else await ctx.db.insert("questCards", {
      roomId: room._id, questIndex: room.questIndex, playerId, card: finalCard,
    });

    const cards = await ctx.db.query("questCards")
      .withIndex("by_room_quest", (q) =>
        q.eq("roomId", room._id).eq("questIndex", room.questIndex))
      .collect();
    if (cards.length >= room.proposedTeam.length) await resolveQuest(ctx, room, players);
  },
});

export const assassinate = mutation({
  args: { code: v.string(), playerId: v.string(), targetId: v.string() },
  handler: async (ctx, { code, playerId, targetId }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.phase !== "assassin") throw new Error("Not the assassin phase.");
    const players = await playersOf(ctx, room._id);
    const me = players.find((p) => p.playerId === playerId);
    if (!me || me.role !== "assassin") throw new Error("Only the Assassin may strike.");
    const target = players.find((p) => p.playerId === targetId);
    const foundMerlin = target?.role === "merlin";
    const theme = THEMES[room.themeId ?? "india"] ?? THEMES.india;
    await ctx.db.patch(room._id, {
      phase: "end", assassinGuess: targetId,
      winner: foundMerlin ? "evil" : "good",
      winReason: foundMerlin
        ? theme.winReasons.assassinHit
        : theme.winReasons.assassinMiss,
    });
  },
});

export const newGame = mutation({
  args: { code: v.string(), playerId: v.string() },
  handler: async (ctx, { code, playerId }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.hostId !== playerId) throw new Error("Only the host can restart.");
    await clearSubmissions(ctx, room._id);
    const players = await playersOf(ctx, room._id);
    for (const p of players) await ctx.db.patch(p._id, { role: undefined });
    await ctx.db.patch(room._id, {
      phase: "lobby", leaderIndex: 0, roundId: 0, questIndex: 0,
      questResults: [null, null, null, null, null], rejectCount: 0, proposedTeam: [],
      lastVote: undefined, lastQuest: undefined,
      winner: undefined, winReason: undefined, assassinGuess: undefined,
    });
  },
});

/* ----------------------------- voice / webrtc --------------------------- */
// Presence: who currently has the mic open.
export const setVoice = mutation({
  args: { code: v.string(), playerId: v.string(), on: v.boolean() },
  handler: async (ctx, { code, playerId, on }) => {
    const room = await roomByCode(ctx, code);
    if (!room) return;
    const players = await playersOf(ctx, room._id);
    const me = players.find((p) => p.playerId === playerId);
    if (me) await ctx.db.patch(me._id, { inVoice: on });
    if (!on) {
      // clear signals addressed to the leaver so they don't pile up
      const incoming = await ctx.db
        .query("signals")
        .withIndex("by_room_to", (q) =>
          q.eq("roomId", room._id).eq("toId", playerId))
        .collect();
      for (const s of incoming) await ctx.db.delete(s._id);
    }
  },
});

// One peer hands a handshake message to another.
export const sendSignal = mutation({
  args: {
    code: v.string(),
    fromId: v.string(),
    toId: v.string(),
    kind: v.union(v.literal("offer"), v.literal("answer"), v.literal("candidate")),
    data: v.string(),
  },
  handler: async (ctx, { code, fromId, toId, kind, data }) => {
    const room = await roomByCode(ctx, code);
    if (!room) return;
    await ctx.db.insert("signals", { roomId: room._id, fromId, toId, kind, data });
  },
});

// Reactive: handshakes waiting for me.
export const getSignals = query({
  args: { code: v.string(), toId: v.string() },
  handler: async (ctx, { code, toId }) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .unique();
    if (!room) return [];
    const sigs = await ctx.db
      .query("signals")
      .withIndex("by_room_to", (q) => q.eq("roomId", room._id).eq("toId", toId))
      .collect();
    sigs.sort((a, b) => a._creationTime - b._creationTime);
    return sigs.map((s) => ({ _id: s._id, fromId: s.fromId, kind: s.kind, data: s.data }));
  },
});

export const clearSignals = mutation({
  args: { ids: v.array(v.id("signals")) },
  handler: async (ctx, { ids }) => {
    for (const id of ids) {
      const doc = await ctx.db.get(id);
      if (doc) await ctx.db.delete(id);
    }
  },
});

/* -------------------------- reactive read model ------------------------- */
// One query powers the whole client. It returns ONLY what `playerId` is allowed
// to see: own role + own knowledge, progress as counts, full reveal only at end.
export const getRoom = query({
  args: { code: v.string(), playerId: v.string() },
  handler: async (ctx, { code, playerId }) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .unique();
    if (!room) return null;

    const players = (
      await ctx.db.query("players")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect()
    ).sort((a, b) => a.seat - b.seat);

    const me = players.find((p) => p.playerId === playerId) ?? null;
    const ended = room.phase === "end";

    // progress counts (no leakage of who voted what)
    const votes = await ctx.db.query("votes")
      .withIndex("by_room_round", (q) =>
        q.eq("roomId", room._id).eq("roundId", room.roundId))
      .collect();
    const cards = await ctx.db.query("questCards")
      .withIndex("by_room_quest", (q) =>
        q.eq("roomId", room._id).eq("questIndex", room.questIndex))
      .collect();

    const theme = THEMES[room.themeId ?? "india"] ?? THEMES.india;

    let known: string[] = [];
    if (me?.role) {
      const others = players
        .filter((p) => p.playerId !== playerId && p.role)
        .map((p) => ({ name: p.name, role: p.role as Role }));
      known = knownNames(me.role as Role, others, theme);
    }

    return {
      code: room.code,
      themeId: room.themeId ?? "india",
      theme,
      phase: room.phase,
      hostId: room.hostId,
      leaderIndex: room.leaderIndex,
      roundId: room.roundId,
      questIndex: room.questIndex,
      questResults: room.questResults,
      rejectCount: room.rejectCount,
      proposedTeam: room.proposedTeam,
      opts: room.opts,
      lastVote: room.lastVote ?? null,
      lastQuest: room.lastQuest ?? null,
      winner: room.winner ?? null,
      winReason: room.winReason ?? null,
      assassinGuess: room.assassinGuess ?? null,
      players: players.map((p) => ({
        playerId: p.playerId,
        name: p.name,
        seat: p.seat,
        isHost: p.playerId === room.hostId,
        inVoice: p.inVoice ?? false,
        role: ended ? p.role ?? null : null, // reveal only at end
      })),
      me: me
        ? { playerId: me.playerId, name: me.name, role: me.role ?? null, known }
        : null,
      voteProgress: {
        voted: votes.length,
        total: players.length,
        iVoted: votes.some((x) => x.playerId === playerId),
      },
      questProgress: {
        submitted: cards.length,
        total: room.proposedTeam.length,
        iSubmitted: cards.some((x) => x.playerId === playerId),
      },
    };
  },
});
