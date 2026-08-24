import { query, mutation, internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  TEAM_COUNTS, QUEST_SIZES, DISCUSS_MS, SELECT_MS,
  PLOT_DEAL_MS, KING_RETURNS_MS, EXCALIBUR_MS, LADY_MS,
  MAX_PLAYERS, MAX_REJECTS, MIN_PLAYERS,
  buildRoles, knownNames, normalizeOpts, validateSetup,
  currentTeam, allowedQuestCards, clampQuestCard, failsNeeded, ROLE_TEAM,
  buildLoyaltyDeck, drawsLoyaltyThisRound,
  buildPlotDeck, plotCardsPerRound, PLOT_CARDS, PlotCardId,
  LADY_MIN_PLAYERS, ladyActiveAfterQuest,
  nightStep, NIGHT_ORDER,
  premiumBlockReason, premiumOptsUsed, isPremiumTheme, seatCap,
  stripPremiumOpts, PREMIUM_OPT_KEYS, PREMIUM_OPT_LABELS,
  ROOM_CAPACITY, splitSeating, compactSeats, swapSeats,
  Role, QuestCard, Opts,
} from "./logic";
import {
  callerEntitlement, roomEntitlement, signedInUser,
  type Entitlement,
} from "./entitlements";
import { THEMES, ThemeConfig } from "./themes";

/* ------------------------------- helpers ------------------------------- */
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const makeCode = () =>
  Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join("");

type RoomPatch = Partial<Omit<Doc<"rooms">, "_id" | "_creationTime">>;

async function roomByCode(ctx: MutationCtx | QueryCtx, code: string) {
  return ctx.db
    .query("rooms")
    .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
    .unique();
}

async function playersOf(ctx: MutationCtx | QueryCtx, roomId: Id<"rooms">) {
  const list = await ctx.db
    .query("players")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
  return list.sort((a, b) => a.seat - b.seat);
}

function requireRoom<T>(r: T | null): T {
  if (!r) throw new Error("Room not found.");
  return r;
}

/**
 * The room roster split into the players at the table and the watchers behind
 * them. Everything that is *the game* — the leader rotation, quest sizes, vote
 * completion, roles — runs on `seated`. `playersOf` remains the full roster and
 * is what voice presence and the watcher queue are built from.
 */
async function seatingOf(ctx: MutationCtx | QueryCtx, room: Doc<"rooms">) {
  const all = await playersOf(ctx, room._id);
  const ent = await roomEntitlement(ctx, room);
  const split = splitSeating(all, seatCap(ent.premium, ent.seats));
  return { all, ...split };
}

/** The players in the game. Throws nothing — a short room is simply short. */
async function seatedOf(ctx: MutationCtx | QueryCtx, room: Doc<"rooms">) {
  return (await seatingOf(ctx, room)).seated;
}

/** Keep seats dense so `splitSeating` and every positional index stay valid. */
async function recompactSeats(ctx: MutationCtx, roomId: Id<"rooms">) {
  const all = await playersOf(ctx, roomId);
  for (const { player, seat } of compactSeats(all)) {
    await ctx.db.patch(player._id, { seat });
  }
}

function themeOf(room: Doc<"rooms">): ThemeConfig {
  return THEMES[room.themeId ?? "india"] ?? THEMES.india;
}

/** Win-reason copy, with sensible fallbacks for reasons a theme has not authored. */
function winReason(theme: ThemeConfig, key: string): string {
  const r = theme.winReasons as Record<string, string | undefined>;
  if (r[key]) return r[key]!;
  switch (key) {
    case "loversHit":
      return "The Assassin unmasks the lovers — their bond betrays them both. Evil triumphs.";
    case "loversMiss":
      return "The Assassin names the wrong pair — the lovers live. Good prevails!";
    default:
      return "The game is over.";
  }
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
  for (const table of ["plotHands", "plotLog", "plotMarks"] as const) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  }
  const secrets = await ctx.db
    .query("secrets")
    .withIndex("by_room_to", (q) => q.eq("roomId", roomId))
    .collect();
  for (const s of secrets) await ctx.db.delete(s._id);
}

async function handOf(ctx: MutationCtx | QueryCtx, roomId: Id<"rooms">, playerId: string) {
  return ctx.db
    .query("plotHands")
    .withIndex("by_room_player", (q) => q.eq("roomId", roomId).eq("playerId", playerId))
    .collect();
}

async function allHands(ctx: MutationCtx | QueryCtx, roomId: Id<"rooms">) {
  return ctx.db
    .query("plotHands")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
}

async function marksOf(ctx: MutationCtx | QueryCtx, roomId: Id<"rooms">) {
  return ctx.db
    .query("plotMarks")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
}

/* ------------------------------- paywall -------------------------------- */

/**
 * Refuse a setup that reaches past the caller's entitlement. Derives identity
 * from `ctx.auth`, so a patched client cannot talk its way into paid content.
 */
async function assertMayUse(
  ctx: MutationCtx,
  themeId: string,
  opts: Opts,
): Promise<Entitlement> {
  const ent = await callerEntitlement(ctx);
  if (ent.premium) return ent;
  const blocked = premiumBlockReason(themeId, opts);
  if (blocked) {
    throw new Error(
      `${blocked} ${
        ent.signedIn
          ? "Upgrade your account to unlock it."
          : "Sign in and upgrade to unlock it."
      }`,
    );
  }
  return ent;
}

/* --------------------------- phase transitions -------------------------- */

/**
 * Enter one of the short expansion windows and schedule its auto-resolution, so a
 * player who walks away can never stall the table. The scheduled `autoAdvance`
 * no-ops unless the room is still sitting in exactly this phase and round.
 */
async function enterTimedPhase(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  phase: "plot" | "kingReturns" | "excalibur" | "lady",
  ms: number,
  patch: RoomPatch = {},
) {
  await ctx.db.patch(roomId, { ...patch, phase, phaseEndsAt: Date.now() + ms });
  const after = await ctx.db.get(roomId);
  if (!after) return;
  await ctx.scheduler.runAfter(ms + 500, internal.avalon.autoAdvance, {
    roomId,
    phase,
    roundId: after.roundId,
    questIndex: after.questIndex,
  });
}

async function enterPropose(ctx: MutationCtx, roomId: Id<"rooms">, patch: RoomPatch = {}) {
  const now = Date.now();
  const discussEndsAt = now + DISCUSS_MS;
  const selectEndsAt = discussEndsAt + SELECT_MS;
  await ctx.db.patch(roomId, {
    ...patch,
    phase: "propose",
    proposedTeam: patch.proposedTeam ?? [],
    excaliburHolder: undefined,
    plotToDeal: undefined,
    kingReturnsPassed: undefined,
    phaseEndsAt: undefined,
    discussEndsAt,
    selectEndsAt,
  });
  const after = await ctx.db.get(roomId);
  if (!after) return;
  await ctx.scheduler.runAfter(
    DISCUSS_MS + SELECT_MS,
    internal.avalon.forceProposeIfNeeded,
    { roomId, roundId: after.roundId },
  );
}

/**
 * Start a quest round: resolve the Lancelot loyalty draw, then either open the
 * plot-card deal or go straight to the leader's proposal.
 */
async function beginRound(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  questIndex: number,
  patch: RoomPatch = {},
) {
  const room = await ctx.db.get(roomId);
  if (!room) return;
  const seated = await seatedOf(ctx, room);
  const opts = normalizeOpts(room.opts);
  const merged: RoomPatch = { ...patch, questIndex };

  if (drawsLoyaltyThisRound(questIndex, opts.lancelot)) {
    const deck = [...(room.loyaltyDeck ?? [])];
    const drawn = deck.shift();
    if (drawn) {
      merged.loyaltyDeck = deck;
      merged.loyaltyLog = [...(room.loyaltyLog ?? []), { questIndex, card: drawn }];
      if (drawn === "switch") {
        merged.lancelotSwapped = !(room.lancelotSwapped ?? false);
      }
    }
  }

  if (opts.plots) {
    const deck = [...(room.plotDeck ?? [])];
    const toDeal = deck.splice(0, Math.min(plotCardsPerRound(seated.length), deck.length));
    if (toDeal.length > 0) {
      await enterTimedPhase(ctx, roomId, "plot", PLOT_DEAL_MS, {
        ...merged,
        plotDeck: deck,
        plotToDeal: toDeal,
        proposedTeam: [],
        excaliburHolder: undefined,
      });
      return;
    }
  }
  await enterPropose(ctx, roomId, merged);
}

/** Plot dealing is finished once nothing is left to hand out and no instant is pending. */
async function plotDealDone(ctx: MutationCtx, room: Doc<"rooms">): Promise<boolean> {
  if ((room.plotToDeal ?? []).length > 0) return false;
  const hands = await allHands(ctx, room._id);
  return !hands.some((h) => PLOT_CARDS[h.card as PlotCardId].kind === "instant");
}

async function maybeLeavePlotPhase(ctx: MutationCtx, roomId: Id<"rooms">) {
  const room = await ctx.db.get(roomId);
  if (!room || room.phase !== "plot") return;
  if (await plotDealDone(ctx, room)) await enterPropose(ctx, roomId);
}

async function enterQuest(ctx: MutationCtx, roomId: Id<"rooms">, patch: RoomPatch = {}) {
  await ctx.db.patch(roomId, {
    ...patch,
    phase: "quest",
    phaseEndsAt: undefined,
    kingReturnsPassed: undefined,
  });
}

/* ------------------------------- voting -------------------------------- */

/** Turn an approved proposal into a rejection — shared by the vote track and King Returns. */
async function applyRejection(
  ctx: MutationCtx,
  room: Doc<"rooms">,
  players: Doc<"players">[],
  lastVote: NonNullable<Doc<"rooms">["lastVote"]>,
) {
  const rc = room.rejectCount + 1;
  if (rc >= MAX_REJECTS) {
    await ctx.db.patch(room._id, {
      phase: "end",
      winner: "evil",
      winReason: themeOf(room).winReasons.fiveRejections,
      rejectCount: rc,
      lastVote,
      phaseEndsAt: undefined,
    });
    return;
  }
  await enterPropose(ctx, room._id, {
    rejectCount: rc,
    leaderIndex: (room.leaderIndex + 1) % players.length,
    roundId: room.roundId + 1,
    proposedTeam: [],
    lastVote,
  });
}

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
  // A tie rejects: the party needs a strict majority to ride out.
  const approved = approvers.length > rejecters.length;
  const lastVote = {
    roundId: room.roundId, approved, approvers, rejecters, team: room.proposedTeam,
  };

  if (!approved) {
    await applyRejection(ctx, room, players, lastVote);
    return;
  }

  // King Returns can still overturn this. Only open the window if someone holds one.
  const opts = normalizeOpts(room.opts);
  if (opts.plots) {
    const hands = await allHands(ctx, room._id);
    if (hands.some((h) => h.card === "king_returns")) {
      await enterTimedPhase(ctx, room._id, "kingReturns", KING_RETURNS_MS, {
        lastVote,
        kingReturnsPassed: [],
      });
      return;
    }
  }
  await enterQuest(ctx, room._id, { rejectCount: 0, lastVote });
}

/* ------------------------------- quests -------------------------------- */

/**
 * Tally the mission, honour any "We Found You" reveals, and move the game on:
 * Lady of the Lake, the next round, the Assassin, or the end.
 */
async function finishQuest(ctx: MutationCtx, roomId: Id<"rooms">) {
  const room = await ctx.db.get(roomId);
  if (!room) return;
  const seated = await seatedOf(ctx, room);
  const n = seated.length;
  const opts = normalizeOpts(room.opts);

  const cards = await ctx.db
    .query("questCards")
    .withIndex("by_room_quest", (q) =>
      q.eq("roomId", roomId).eq("questIndex", room.questIndex))
    .collect();
  const fails = cards.filter((c) => c.card === "fail").length;
  const success = fails < failsNeeded(n, room.questIndex);

  // "We Found You" forces specific mission cards public.
  const marks = await marksOf(ctx, roomId);
  const forced = new Set(
    marks
      .filter((m) => m.kind === "revealCard" && m.questIndex === room.questIndex)
      .map((m) => m.playerId),
  );
  const revealed = cards
    .filter((c) => forced.has(c.playerId))
    .map((c) => ({ playerId: c.playerId, card: c.card }))
    .sort((a, b) => a.playerId.localeCompare(b.playerId));

  const results = [...room.questResults];
  results[room.questIndex] = success ? "success" : "fail";
  const successes = results.filter((x) => x === "success").length;
  const failures = results.filter((x) => x === "fail").length;
  const lastQuest = {
    questIndex: room.questIndex,
    fails,
    success,
    size: room.proposedTeam.length,
    revealed: revealed.length > 0 ? revealed : undefined,
  };

  if (failures >= 3) {
    await ctx.db.patch(roomId, {
      phase: "end", winner: "evil", questResults: results, lastQuest,
      winReason: themeOf(room).winReasons.threeFails,
      phaseEndsAt: undefined,
    });
    return;
  }
  if (successes >= 3) {
    await ctx.db.patch(roomId, {
      phase: "assassin", questResults: results, lastQuest, phaseEndsAt: undefined,
    });
    return;
  }

  const nextRoundPatch: RoomPatch = {
    questResults: results,
    lastQuest,
    leaderIndex: (room.leaderIndex + 1) % n,
    roundId: room.roundId + 1,
    rejectCount: 0,
    proposedTeam: [],
    excaliburHolder: undefined,
  };

  // The Lady of the Lake speaks between quests 2–4, before the next round opens.
  const ladyHasTarget =
    room.ladyHolder != null &&
    seated.some(
      (pl) =>
        pl.playerId !== room.ladyHolder &&
        !(room.ladyHistory ?? []).includes(pl.playerId),
    );
  if (
    opts.lady &&
    n >= LADY_MIN_PLAYERS &&
    ladyActiveAfterQuest(room.questIndex) &&
    ladyHasTarget
  ) {
    await enterTimedPhase(ctx, roomId, "lady", LADY_MS, nextRoundPatch);
    return;
  }
  await beginRound(ctx, roomId, room.questIndex + 1, nextRoundPatch);
}

/** Is Excalibur actually in a position to be swung this quest? */
function swordArmed(room: Doc<"rooms">): boolean {
  const opts = normalizeOpts(room.opts);
  return Boolean(
    opts.excalibur &&
      room.excaliburHolder &&
      room.proposedTeam.includes(room.excaliburHolder),
  );
}

/**
 * All cards are in. Hold them sealed for a beat if anything can still act on
 * them — Excalibur, or an Ambush waiting to peek — otherwise tally right away.
 */
async function afterAllQuestCards(ctx: MutationCtx, room: Doc<"rooms">) {
  const opts = normalizeOpts(room.opts);
  let ambushLive = false;
  if (opts.plots) {
    const hands = await allHands(ctx, room._id);
    ambushLive = hands.some((h) => h.card === "ambush");
  }
  if (swordArmed(room) || ambushLive) {
    await enterTimedPhase(ctx, room._id, "excalibur", EXCALIBUR_MS);
    return;
  }
  await finishQuest(ctx, room._id);
}

/* ------------------------------ plot cards ------------------------------ */

/** Cards that resolve the instant they are handed over, with no choice to make. */
async function resolveAutoInstant(
  ctx: MutationCtx,
  room: Doc<"rooms">,
  players: Doc<"players">[],
  card: PlotCardId,
  toId: string,
): Promise<boolean> {
  if (card === "charge") {
    await ctx.db.insert("plotMarks", { roomId: room._id, playerId: toId, kind: "charge" });
    await ctx.db.insert("plotLog", {
      roomId: room._id, questIndex: room.questIndex, card, byId: toId,
    });
    return true;
  }
  if (card === "show_strength") {
    // The leader must show this player their loyalty card.
    const leader = players[room.leaderIndex] ?? players[0];
    if (leader.role) {
      await ctx.db.insert("secrets", {
        roomId: room._id,
        toId,
        questIndex: room.questIndex,
        kind: "loyalty",
        subjectId: leader.playerId,
        team: currentTeam(leader.role as Role, room.lancelotSwapped ?? false),
      });
    }
    await ctx.db.insert("plotLog", {
      roomId: room._id, questIndex: room.questIndex, card, byId: toId,
      targetId: leader.playerId,
    });
    return true;
  }
  return false;
}

/* ------------------------------ mutations ------------------------------ */

const optsValidator = v.object({
  percival: v.boolean(),
  morgana: v.boolean(),
  mordred: v.boolean(),
  oberon: v.boolean(),
  guinevere: v.optional(v.boolean()),
  lovers: v.optional(v.boolean()),
  lancelot: v.optional(v.boolean()),
  lady: v.optional(v.boolean()),
  excalibur: v.optional(v.boolean()),
  plots: v.optional(v.boolean()),
});

export const createRoom = mutation({
  args: {
    playerId: v.string(),
    name: v.string(),
    themeId: v.optional(v.string()),
    opts: optsValidator,
  },
  handler: async (ctx, { playerId, name, themeId, opts }) => {
    const resolvedTheme = themeId ?? "india";
    if (!THEMES[resolvedTheme]) throw new Error(`Theme ${resolvedTheme} not found.`);
    const normalized = normalizeOpts(opts);
    await assertMayUse(ctx, resolvedTheme, normalized);
    const host = await signedInUser(ctx);
    let code = makeCode();
    for (let i = 0; i < 6 && (await roomByCode(ctx, code)); i++) code = makeCode();
    const roomId = await ctx.db.insert("rooms", {
      code,
      themeId: resolvedTheme,
      hostId: playerId,
      hostUserId: host?._id,
      phase: "lobby",
      leaderIndex: 0,
      roundId: 0,
      questIndex: 0,
      questResults: [null, null, null, null, null],
      rejectCount: 0,
      proposedTeam: [],
      opts: normalized,
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
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Speak your name first.");

    // Same tab/session: reclaim this playerId's seat (survives refresh).
    const byId = players.find((p) => p.playerId === playerId);
    if (byId) {
      if (byId.name !== trimmed && room.phase === "lobby") {
        const taken = players.some(
          (p) =>
            p.playerId !== playerId &&
            p.name.toLowerCase() === trimmed.toLowerCase(),
        );
        if (taken) throw new Error(`The name "${trimmed}" is already taken.`);
        await ctx.db.patch(byId._id, { name: trimmed });
      }
      return { code: room.code, playerId };
    }

    const byName = players.find(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (byName) {
      throw new Error(
        `The name "${trimmed}" is already seated. Pick a unique name — each tab is its own warrior.`,
      );
    }

    if (room.phase !== "lobby") throw new Error("That game has already started.");
    // Past the seat cap a newcomer becomes a watcher rather than being refused;
    // only the abuse ceiling actually rejects.
    if (players.length >= ROOM_CAPACITY) {
      throw new Error(`This room is full (${ROOM_CAPACITY} people).`);
    }
    await ctx.db.insert("players", {
      roomId: room._id, playerId, name: trimmed, seat: players.length,
    });
    return { code: room.code, playerId };
  },
});

export const leaveRoom = mutation({
  args: { code: v.string(), playerId: v.string() },
  handler: async (ctx, { code, playerId }) => {
    const room = await roomByCode(ctx, code);
    if (!room) return;
    const players = await playersOf(ctx, room._id);
    const me = players.find((p) => p.playerId === playerId);

    // Mid-game, only a watcher may slip out: removing a seated player would
    // orphan their role, votes and quest card.
    if (room.phase !== "lobby") {
      const { watching } = await seatingOf(ctx, room);
      if (!me || !watching.some((w) => w.playerId === playerId)) return;
      await ctx.db.delete(me._id);
      await recompactSeats(ctx, room._id);
      return;
    }

    if (me) await ctx.db.delete(me._id);

    const rest = players.filter((p) => p.playerId !== playerId);
    if (rest.length === 0) {
      await ctx.db.delete(room._id);
      return;
    }
    // Reindex seats to stay dense — this is also what promotes the first
    // watcher into a freed seat, with no extra bookkeeping.
    for (let i = 0; i < rest.length; i++) {
      if (rest[i].seat !== i) await ctx.db.patch(rest[i]._id, { seat: i });
    }
    if (room.hostId === playerId) {
      await ctx.db.patch(room._id, { hostId: rest[0].playerId });
    }
  },
});

/** Host pulls a specific watcher to the table, swapping them with a seated player. */
export const swapSeat = mutation({
  args: {
    code: v.string(),
    playerId: v.string(),
    watcherId: v.string(),
    seatedId: v.string(),
  },
  handler: async (ctx, { code, playerId, watcherId, seatedId }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.hostId !== playerId) throw new Error("Only the host can seat watchers.");
    if (room.phase !== "lobby") throw new Error("Seats are fixed once the game starts.");
    const { all, seated, watching } = await seatingOf(ctx, room);
    if (!watching.some((w) => w.playerId === watcherId)) {
      throw new Error("That player is already at the table.");
    }
    if (!seated.some((p) => p.playerId === seatedId)) {
      throw new Error("That player is not at the table.");
    }
    const moves = swapSeats(all, watcherId, seatedId);
    if (!moves) throw new Error("Could not swap those two.");
    for (const { player, seat } of moves) {
      await ctx.db.patch(player._id, { seat });
    }
  },
});

export const setOpts = mutation({
  args: { code: v.string(), playerId: v.string(), opts: optsValidator },
  handler: async (ctx, { code, playerId, opts }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.hostId !== playerId) throw new Error("Only the host can change roles.");
    if (room.phase !== "lobby") return;
    const normalized = normalizeOpts(opts);
    const ent = await callerEntitlement(ctx);

    if (ent.premium) {
      await ctx.db.patch(room._id, { opts: normalized });
      return;
    }

    // Free tier. Refuse to switch a paid option ON, but always allow switching
    // one OFF — otherwise a room whose plan lapsed mid-lobby would be stuck
    // with unusable options it could never clear.
    const current = normalizeOpts(room.opts);
    const newlyOn = PREMIUM_OPT_KEYS.filter((k) => normalized[k] && !current[k]);
    if (newlyOn.length > 0) {
      const names = newlyOn.map((k) => PREMIUM_OPT_LABELS[k] ?? k).join(", ");
      throw new Error(
        `${names} ${newlyOn.length === 1 ? "is" : "are"} premium. ${
          ent.signedIn
            ? "Upgrade your account to unlock it."
            : "Sign in and upgrade to unlock it."
        }`,
      );
    }
    await ctx.db.patch(room._id, { opts: stripPremiumOpts(normalized) });
  },
});

export const changeTheme = mutation({
  args: { code: v.string(), playerId: v.string(), themeId: v.string() },
  handler: async (ctx, { code, playerId, themeId }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.hostId !== playerId) throw new Error("Only the host can change themes.");
    if (room.phase !== "lobby") throw new Error("Cannot change theme after game started.");
    if (!THEMES[themeId]) throw new Error(`Theme ${themeId} not found.`);
    await assertMayUse(ctx, themeId, normalizeOpts(room.opts));
    await ctx.db.patch(room._id, { themeId });
  },
});

export const startGame = mutation({
  args: { code: v.string(), playerId: v.string() },
  handler: async (ctx, { code, playerId }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.hostId !== playerId) throw new Error("Only the host can start.");
    // Only the seated play. Watchers keep their place in the queue and are
    // dealt nothing — the game is sized to the table, not to the room.
    const { all, seated } = await seatingOf(ctx, room);
    const n = seated.length;
    if (n < MIN_PLAYERS) throw new Error(`Need at least ${MIN_PLAYERS} players.`);

    const opts = normalizeOpts(room.opts);
    const errs = validateSetup(n, opts);
    if (errs.length > 0) throw new Error(errs.join(" "));

    // Re-check the paywall at the last moment: a plan may have lapsed or been
    // revoked since the host set these options.
    const roomEnt = await roomEntitlement(ctx, room);
    if (!roomEnt.premium) {
      const blocked = premiumBlockReason(room.themeId, opts);
      if (blocked) throw new Error(`${blocked} The host needs an active plan.`);
    }

    await clearSubmissions(ctx, room._id);
    const roles = buildRoles(seated.map((p) => p.playerId), opts);
    for (const p of all) {
      // Watchers must never carry a role, including a stale one from last game.
      await ctx.db.patch(p._id, { role: roles[p.playerId] });
    }

    const leaderIndex = Math.floor(Math.random() * n);
    // The Lady of the Lake starts with the player to the first leader's right —
    // i.e. the one who will be leader last — and never returns to a past holder.
    const ladyOn = opts.lady && n >= LADY_MIN_PLAYERS;
    const ladyStart = seated[(leaderIndex - 1 + n) % n].playerId;

    await ctx.db.patch(room._id, {
      phase: "reveal",
      leaderIndex,
      roundId: 1,
      questIndex: 0,
      questResults: [null, null, null, null, null],
      rejectCount: 0,
      proposedTeam: [],
      lastVote: undefined, lastQuest: undefined,
      winner: undefined, winReason: undefined,
      assassinGuess: undefined, assassinGuess2: undefined, assassinMode: undefined,
      phaseEndsAt: undefined, discussEndsAt: undefined, selectEndsAt: undefined,
      lancelotSwapped: false,
      loyaltyDeck: opts.lancelot ? buildLoyaltyDeck() : undefined,
      loyaltyLog: [],
      ladyHolder: ladyOn ? ladyStart : undefined,
      ladyHistory: ladyOn ? [ladyStart] : undefined,
      lastLady: undefined,
      excaliburHolder: undefined,
      lastExcalibur: undefined,
      plotDeck: opts.plots ? buildPlotDeck(n) : undefined,
      plotToDeal: undefined,
      kingReturnsPassed: undefined,
    });
  },
});

export const beginQuests = mutation({
  args: { code: v.string(), playerId: v.string() },
  handler: async (ctx, { code, playerId }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.hostId !== playerId) throw new Error("Only the host can begin.");
    if (room.phase === "reveal") await beginRound(ctx, room._id, 0);
  },
});

export const forceProposeIfNeeded = internalMutation({
  args: { roomId: v.id("rooms"), roundId: v.number() },
  handler: async (ctx, { roomId, roundId }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.phase !== "propose" || room.roundId !== roundId) return;
    const seated = await seatedOf(ctx, room);
    if (seated.length === 0) return;
    const size = QUEST_SIZES[seated.length]?.[room.questIndex];
    if (!size) return;
    const leader = seated[room.leaderIndex] ?? seated[0];
    const rest = seated.filter((p) => p.playerId !== leader.playerId);
    const team = [leader.playerId, ...rest.map((p) => p.playerId)].slice(0, size);
    const opts = normalizeOpts(room.opts);
    // Excalibur must go to a party member other than the leader.
    const excaliburHolder = opts.excalibur
      ? team.find((id) => id !== leader.playerId)
      : undefined;
    await ctx.db.patch(roomId, { phase: "vote", proposedTeam: team, excaliburHolder });
  },
});

/**
 * Auto-resolve a stalled expansion window to its do-nothing outcome. Guarded on
 * phase + round so a late timer for an already-advanced game is a no-op.
 */
export const autoAdvance = internalMutation({
  args: {
    roomId: v.id("rooms"),
    phase: v.union(
      v.literal("plot"), v.literal("kingReturns"),
      v.literal("excalibur"), v.literal("lady"),
    ),
    roundId: v.number(),
    questIndex: v.number(),
  },
  handler: async (ctx, { roomId, phase, roundId, questIndex }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return;
    if (room.phase !== phase || room.roundId !== roundId || room.questIndex !== questIndex) {
      return;
    }
    const seated = await seatedOf(ctx, room);

    if (phase === "plot") {
      // Deal whatever is left at random, then bin any instant nobody played.
      const toDeal = [...(room.plotToDeal ?? [])];
      const leader = seated[room.leaderIndex] ?? seated[0];
      const eligible = seated.filter((p) => p.playerId !== leader.playerId);
      for (const card of toDeal) {
        if (eligible.length === 0) break;
        const to = eligible[Math.floor(Math.random() * eligible.length)].playerId;
        const handled = await resolveAutoInstant(ctx, room, seated, card as PlotCardId, to);
        if (!handled) {
          await ctx.db.insert("plotHands", {
            roomId, playerId: to, card, dealtQuest: room.questIndex,
          });
        }
      }
      const hands = await allHands(ctx, roomId);
      for (const h of hands) {
        if (PLOT_CARDS[h.card as PlotCardId].kind === "instant") await ctx.db.delete(h._id);
      }
      await enterPropose(ctx, roomId, { plotToDeal: undefined });
      return;
    }

    if (phase === "kingReturns") {
      await enterQuest(ctx, roomId, { rejectCount: 0 });
      return;
    }

    if (phase === "excalibur") {
      if (swordArmed(room)) {
        await ctx.db.patch(roomId, {
          lastExcalibur: {
            questIndex: room.questIndex,
            holderId: room.excaliburHolder!,
            used: false,
          },
        });
      }
      await finishQuest(ctx, roomId);
      return;
    }

    // lady: keep the token moving rather than letting it die on the vine.
    const holder = room.ladyHolder;
    const history = room.ladyHistory ?? [];
    const target = seated.find(
      (p) => p.playerId !== holder && !history.includes(p.playerId),
    );
    if (holder && target && target.role) {
      await ctx.db.insert("secrets", {
        roomId, toId: holder, questIndex: room.questIndex, kind: "lady",
        subjectId: target.playerId,
        team: currentTeam(target.role as Role, room.lancelotSwapped ?? false),
      });
      await beginRound(ctx, roomId, room.questIndex + 1, {
        lastLady: { questIndex: room.questIndex, holderId: holder, targetId: target.playerId },
        ladyHolder: target.playerId,
        ladyHistory: [...history, target.playerId],
      });
      return;
    }
    await beginRound(ctx, roomId, room.questIndex + 1);
  },
});

export const proposeTeam = mutation({
  args: {
    code: v.string(),
    playerId: v.string(),
    team: v.array(v.string()),
    excaliburId: v.optional(v.string()),
  },
  handler: async (ctx, { code, playerId, team, excaliburId }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.phase !== "propose") throw new Error("Not the proposal phase.");
    const seated = await seatedOf(ctx, room);
    const leader = seated[room.leaderIndex];
    if (leader.playerId !== playerId) throw new Error("Only the leader proposes.");
    const size = QUEST_SIZES[seated.length][room.questIndex];
    if (team.length !== size) throw new Error(`Party must be ${size} knights.`);
    // Watchers are not in the game, so they can never ride.
    const ids = new Set(seated.map((p) => p.playerId));
    if (team.some((id) => !ids.has(id))) throw new Error("Party must be seated warriors.");
    if (new Set(team).size !== team.length) throw new Error("Party cannot repeat a warrior.");

    const opts = normalizeOpts(room.opts);
    let holder: string | undefined = undefined;
    if (opts.excalibur) {
      if (!excaliburId) throw new Error("Hand Excalibur to one of the party.");
      if (!team.includes(excaliburId)) {
        throw new Error("Excalibur must go to a member of the party.");
      }
      if (excaliburId === playerId) {
        throw new Error("You cannot keep Excalibur for yourself.");
      }
      holder = excaliburId;
    }

    await ctx.db.patch(room._id, {
      phase: "vote",
      proposedTeam: team,
      excaliburHolder: holder,
      phaseEndsAt: undefined,
    });
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
    const seated = await seatedOf(ctx, room);
    if (!seated.some((p) => p.playerId === playerId)) {
      throw new Error("Watchers do not vote.");
    }

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
    if (votes.length >= seated.length) await resolveVotes(ctx, room, seated);
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
    const seated = await seatedOf(ctx, room);
    const me = seated.find((p) => p.playerId === playerId);
    if (!me) throw new Error("Watchers do not ride.");
    // Server enforces the secrecy rules: the loyal may only succeed, and the
    // Lancelots are locked to their current allegiance's card.
    const finalCard = clampQuestCard(
      me.role as Role | undefined,
      room.lancelotSwapped ?? false,
      card,
    );

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
    if (cards.length >= room.proposedTeam.length) await afterAllQuestCards(ctx, room);
  },
});

/* ------------------------------- Excalibur ------------------------------ */

export const useExcalibur = mutation({
  args: {
    code: v.string(),
    playerId: v.string(),
    /** Omit to decline. */
    targetId: v.optional(v.string()),
  },
  handler: async (ctx, { code, playerId, targetId }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.phase !== "excalibur") throw new Error("Excalibur is not drawn.");
    if (room.excaliburHolder !== playerId) throw new Error("You do not hold Excalibur.");

    if (targetId) {
      if (!room.proposedTeam.includes(targetId)) {
        throw new Error("Excalibur only reaches the party.");
      }
      if (targetId === playerId) throw new Error("You cannot turn Excalibur on yourself.");
      const cards = await ctx.db
        .query("questCards")
        .withIndex("by_room_quest", (q) =>
          q.eq("roomId", room._id).eq("questIndex", room.questIndex))
        .collect();
      const target = cards.find((c) => c.playerId === targetId);
      if (!target) throw new Error("That warrior played no card.");
      await ctx.db.patch(target._id, {
        card: target.card === "success" ? "fail" : "success",
        flipped: true,
      });
    }

    await ctx.db.patch(room._id, {
      lastExcalibur: {
        questIndex: room.questIndex,
        holderId: playerId,
        targetId,
        used: Boolean(targetId),
      },
      phaseEndsAt: undefined,
    });
    await finishQuest(ctx, room._id);
  },
});

/* --------------------------- Lady of the Lake --------------------------- */

export const useLady = mutation({
  args: { code: v.string(), playerId: v.string(), targetId: v.string() },
  handler: async (ctx, { code, playerId, targetId }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.phase !== "lady") throw new Error("The Lady is not listening.");
    if (room.ladyHolder !== playerId) throw new Error("You do not hold the Lady of the Lake.");
    if (targetId === playerId) throw new Error("Look to another.");
    const history = room.ladyHistory ?? [];
    if (history.includes(targetId)) {
      throw new Error("That warrior has already held the Lady — they cannot be examined.");
    }
    const seated = await seatedOf(ctx, room);
    const target = seated.find((p) => p.playerId === targetId);
    if (!target || !target.role) throw new Error("No such warrior.");

    await ctx.db.insert("secrets", {
      roomId: room._id,
      toId: playerId,
      questIndex: room.questIndex,
      kind: "lady",
      subjectId: targetId,
      team: currentTeam(target.role as Role, room.lancelotSwapped ?? false),
    });

    await beginRound(ctx, room._id, room.questIndex + 1, {
      lastLady: { questIndex: room.questIndex, holderId: playerId, targetId },
      ladyHolder: targetId,
      ladyHistory: [...history, targetId],
    });
  },
});

/* ------------------------------ plot cards ------------------------------ */

/** The leader hands the next (face-down) plot card to a player. */
export const dealPlotCard = mutation({
  args: { code: v.string(), playerId: v.string(), toId: v.string() },
  handler: async (ctx, { code, playerId, toId }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.phase !== "plot") throw new Error("Not the plotting phase.");
    const seated = await seatedOf(ctx, room);
    const leader = seated[room.leaderIndex] ?? seated[0];
    if (leader.playerId !== playerId) throw new Error("Only the leader deals plot cards.");
    if (toId === playerId) throw new Error("You cannot deal a plot card to yourself.");
    if (!seated.some((p) => p.playerId === toId)) {
      throw new Error("Plot cards only go to warriors at the table.");
    }

    const queue = [...(room.plotToDeal ?? [])];
    const card = queue.shift();
    if (!card) throw new Error("No plot cards left to deal.");

    const handled = await resolveAutoInstant(ctx, room, seated, card as PlotCardId, toId);
    if (!handled) {
      await ctx.db.insert("plotHands", {
        roomId: room._id, playerId: toId, card, dealtQuest: room.questIndex,
      });
    }
    await ctx.db.patch(room._id, { plotToDeal: queue });
    await maybeLeavePlotPhase(ctx, room._id);
  },
});

export const playPlotCard = mutation({
  args: {
    code: v.string(),
    playerId: v.string(),
    card: v.union(
      v.literal("lead_to_victory"), v.literal("ambush"), v.literal("king_returns"),
      v.literal("we_found_you"), v.literal("restore_honor"), v.literal("show_true_nature"),
      v.literal("are_you_the_one"),
    ),
    targetId: v.optional(v.string()),
  },
  handler: async (ctx, { code, playerId, card, targetId }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    const seated = await seatedOf(ctx, room);
    const me = seated.find((p) => p.playerId === playerId);
    if (!me) throw new Error("Watchers hold no plot cards.");

    const def = PLOT_CARDS[card as PlotCardId];
    const hand = await handOf(ctx, room._id, playerId);
    const held = hand.find((h) => h.card === card);
    if (!held) throw new Error("You do not hold that plot card.");

    // Instant cards live only inside the plot window; usable ones have their own.
    // Ambush additionally reaches into the sealed-cards window, so a full party
    // does not leave it unplayable.
    const windows: string[] =
      def.kind === "instant"
        ? ["plot"]
        : card === "ambush"
          ? ["quest", "excalibur"]
          : [def.window];
    if (!windows.includes(room.phase)) {
      throw new Error("You cannot play that right now.");
    }
    if (def.needsTarget && !targetId) throw new Error("Choose a target.");

    const target = targetId ? seated.find((p) => p.playerId === targetId) : undefined;
    if (targetId && !target) throw new Error("No such warrior.");
    const swapped = room.lancelotSwapped ?? false;
    const logPublic = async (tid?: string) => {
      await ctx.db.insert("plotLog", {
        roomId: room._id, questIndex: room.questIndex, card, byId: playerId, targetId: tid,
      });
    };

    switch (card) {
      case "lead_to_victory": {
        await ctx.db.delete(held._id);
        await logPublic();
        // Bumping roundId retires the proposal timer scheduled for the old
        // leader, so the new one gets a full clock. No votes exist yet.
        await enterPropose(ctx, room._id, {
          leaderIndex: me.seat,
          proposedTeam: [],
          roundId: room.roundId + 1,
        });
        return;
      }

      case "we_found_you": {
        if (!room.proposedTeam.includes(targetId!)) {
          throw new Error("Only a member of the proposed party can be called out.");
        }
        await ctx.db.delete(held._id);
        await ctx.db.insert("plotMarks", {
          roomId: room._id, playerId: targetId!, kind: "revealCard",
          questIndex: room.questIndex,
        });
        await logPublic(targetId);
        return;
      }

      case "ambush": {
        if (!room.proposedTeam.includes(targetId!)) {
          throw new Error("Only a member of the party can be ambushed.");
        }
        if (targetId === playerId) throw new Error("Ambush another warrior.");
        // One target per player per mission.
        const mine = await ctx.db
          .query("secrets")
          .withIndex("by_room_to", (q) => q.eq("roomId", room._id).eq("toId", playerId))
          .collect();
        if (mine.some((s) => s.kind === "ambush" && s.questIndex === room.questIndex)) {
          throw new Error("You have already ambushed someone this mission.");
        }
        const cards = await ctx.db
          .query("questCards")
          .withIndex("by_room_quest", (q) =>
            q.eq("roomId", room._id).eq("questIndex", room.questIndex))
          .collect();
        const played = cards.find((c) => c.playerId === targetId);
        if (!played) throw new Error("They have not played their card yet.");
        await ctx.db.delete(held._id);
        // Deliberately not logged: an Ambush happens without announcement.
        await ctx.db.insert("secrets", {
          roomId: room._id, toId: playerId, questIndex: room.questIndex,
          kind: "ambush", subjectId: targetId!, card: played.card,
        });
        return;
      }

      case "king_returns": {
        if (!room.lastVote || !room.lastVote.approved) {
          throw new Error("There is no approved party to overturn.");
        }
        await ctx.db.delete(held._id);
        await logPublic();
        await applyRejection(ctx, room, seated, {
          ...room.lastVote,
          approved: false,
          overturnedBy: playerId,
        });
        return;
      }

      case "restore_honor": {
        if (targetId === playerId) throw new Error("Take from another player.");
        const theirs = await handOf(ctx, room._id, targetId!);
        if (theirs.length === 0) throw new Error("They hold no plot cards.");
        const taken = theirs[Math.floor(Math.random() * theirs.length)];
        await ctx.db.patch(taken._id, { playerId });
        await ctx.db.delete(held._id);
        await logPublic(targetId);
        await maybeLeavePlotPhase(ctx, room._id);
        return;
      }

      case "show_true_nature": {
        if (targetId === playerId) throw new Error("Show another player.");
        if (!me.role) throw new Error("You have no loyalty card yet.");
        await ctx.db.delete(held._id);
        await ctx.db.insert("secrets", {
          roomId: room._id, toId: targetId!, questIndex: room.questIndex,
          kind: "loyalty", subjectId: playerId,
          team: currentTeam(me.role as Role, swapped),
        });
        await logPublic(targetId);
        await maybeLeavePlotPhase(ctx, room._id);
        return;
      }

      case "are_you_the_one": {
        // Neighbours are around the TABLE, so seated-only and seat === index.
        const n = seated.length;
        const left = seated[(me.seat - 1 + n) % n].playerId;
        const right = seated[(me.seat + 1) % n].playerId;
        if (targetId !== left && targetId !== right) {
          throw new Error("You may only question a warrior seated beside you.");
        }
        if (!target!.role) throw new Error("They have no loyalty card yet.");
        await ctx.db.delete(held._id);
        await ctx.db.insert("secrets", {
          roomId: room._id, toId: playerId, questIndex: room.questIndex,
          kind: "loyalty", subjectId: targetId!,
          team: currentTeam(target!.role as Role, swapped),
        });
        await logPublic(targetId);
        await maybeLeavePlotPhase(ctx, room._id);
        return;
      }
    }
  },
});

/**
 * Bin an instant plot card you cannot or will not use. Without this a card like
 * Restore Your Honor, dealt when nobody else holds anything, would wedge the
 * plot phase until its timer expired.
 */
export const discardPlotCard = mutation({
  args: { code: v.string(), playerId: v.string(), card: v.string() },
  handler: async (ctx, { code, playerId, card }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.phase !== "plot") throw new Error("Only during the plotting phase.");
    const def = PLOT_CARDS[card as PlotCardId];
    if (!def) throw new Error("No such plot card.");
    if (def.kind !== "instant") throw new Error("Only instant plots can be set aside.");
    const hand = await handOf(ctx, room._id, playerId);
    const held = hand.find((h) => h.card === card);
    if (!held) throw new Error("You do not hold that plot card.");
    await ctx.db.delete(held._id);
    await maybeLeavePlotPhase(ctx, room._id);
  },
});

/**
 * Close the sealed-cards window when Excalibur is not in play — the window only
 * exists so an Ambush has somewhere to land, so anyone at the table may end it.
 */
export const sealQuest = mutation({
  args: { code: v.string(), playerId: v.string() },
  handler: async (ctx, { code, playerId }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.phase !== "excalibur") return;
    if (swordArmed(room)) {
      throw new Error("The Excalibur bearer has yet to decide.");
    }
    const seated = await seatedOf(ctx, room);
    if (!seated.some((p) => p.playerId === playerId)) {
      throw new Error("Not at this table.");
    }
    await finishQuest(ctx, room._id);
  },
});

/** Decline to overturn the approved party. Once every holder passes, the quest rides. */
export const passKingReturns = mutation({
  args: { code: v.string(), playerId: v.string() },
  handler: async (ctx, { code, playerId }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.phase !== "kingReturns") return;
    const passed = new Set(room.kingReturnsPassed ?? []);
    passed.add(playerId);
    await ctx.db.patch(room._id, { kingReturnsPassed: [...passed] });

    const hands = await allHands(ctx, room._id);
    const holders = new Set(
      hands.filter((h) => h.card === "king_returns").map((h) => h.playerId),
    );
    if ([...holders].every((id) => passed.has(id))) {
      await enterQuest(ctx, room._id, { rejectCount: 0 });
    }
  },
});

/* ----------------------------- assassination ---------------------------- */

export const assassinate = mutation({
  args: {
    code: v.string(),
    playerId: v.string(),
    targetId: v.string(),
    /** "lovers" names Tristan and Isolde together instead of Merlin. */
    mode: v.optional(v.union(v.literal("merlin"), v.literal("lovers"))),
    targetId2: v.optional(v.string()),
  },
  handler: async (ctx, { code, playerId, targetId, mode, targetId2 }) => {
    const room = requireRoom(await roomByCode(ctx, code));
    if (room.phase !== "assassin") throw new Error("Not the assassin phase.");
    const seated = await seatedOf(ctx, room);
    const me = seated.find((p) => p.playerId === playerId);
    if (!me || me.role !== "assassin") throw new Error("Only the Assassin may strike.");
    const theme = themeOf(room);
    const resolvedMode = mode ?? "merlin";

    if (resolvedMode === "lovers") {
      const loversInPlay = seated.some((p) => p.role === "tristan")
        && seated.some((p) => p.role === "isolde");
      if (!loversInPlay) throw new Error("The lovers are not in this game.");
      if (!targetId2) throw new Error("Name both lovers.");
      if (targetId === targetId2) throw new Error("Name two different warriors.");
      const roles = [targetId, targetId2].map(
        (id) => seated.find((p) => p.playerId === id)?.role,
      );
      const hit = roles.includes("tristan") && roles.includes("isolde");
      await ctx.db.patch(room._id, {
        phase: "end",
        assassinMode: "lovers",
        assassinGuess: targetId,
        assassinGuess2: targetId2,
        winner: hit ? "evil" : "good",
        winReason: winReason(theme, hit ? "loversHit" : "loversMiss"),
        phaseEndsAt: undefined,
      });
      return;
    }

    const target = seated.find((p) => p.playerId === targetId);
    const foundMerlin = target?.role === "merlin";
    await ctx.db.patch(room._id, {
      phase: "end",
      assassinMode: "merlin",
      assassinGuess: targetId,
      assassinGuess2: undefined,
      winner: foundMerlin ? "evil" : "good",
      winReason: foundMerlin
        ? theme.winReasons.assassinHit
        : theme.winReasons.assassinMiss,
      phaseEndsAt: undefined,
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
      winner: undefined, winReason: undefined,
      assassinGuess: undefined, assassinGuess2: undefined, assassinMode: undefined,
      discussEndsAt: undefined, selectEndsAt: undefined, phaseEndsAt: undefined,
      lancelotSwapped: undefined, loyaltyDeck: undefined, loyaltyLog: undefined,
      ladyHolder: undefined, ladyHistory: undefined, lastLady: undefined,
      excaliburHolder: undefined, lastExcalibur: undefined,
      plotDeck: undefined, plotToDeal: undefined, kingReturnsPassed: undefined,
    });
  },
});

/* -------------------------- reactive read model ------------------------- */
// One query powers the whole client. It returns ONLY what `playerId` is allowed
// to see: own role + own knowledge + own secrets, progress as counts, and the
// full reveal only at game end.
export const getRoom = query({
  args: { code: v.string(), playerId: v.string() },
  handler: async (ctx, { code, playerId }) => {
    const room = await roomByCode(ctx, code);
    if (!room) return null;

    // `players` is everyone in the room; `seated` is everyone in the GAME.
    // Every rules-derived number below is sized to the table, not the room.
    const roomEnt0 = await roomEntitlement(ctx, room);
    const cap = seatCap(roomEnt0.premium, roomEnt0.seats);
    const players = await playersOf(ctx, room._id);
    const { seated, watching, overflowing } = splitSeating(players, cap);
    const seatedIds = new Set(seated.map((p) => p.playerId));
    const me = players.find((p) => p.playerId === playerId) ?? null;
    const iAmWatching = me != null && !seatedIds.has(me.playerId);
    const ended = room.phase === "end";
    const opts = normalizeOpts(room.opts);
    const swapped = room.lancelotSwapped ?? false;
    const n = seated.length;

    const votes = await ctx.db.query("votes")
      .withIndex("by_room_round", (q) =>
        q.eq("roomId", room._id).eq("roundId", room.roundId))
      .collect();
    const cards = await ctx.db.query("questCards")
      .withIndex("by_room_quest", (q) =>
        q.eq("roomId", room._id).eq("questIndex", room.questIndex))
      .collect();

    const theme = themeOf(room);
    const nameOf = (id: string) => players.find((p) => p.playerId === id)?.name ?? "?";

    // Paywall state. `room` follows the HOST's plan; `caller` is about me, so the
    // lobby can offer the right prompt (sign in / upgrade / already covered).
    const roomEnt = roomEnt0;
    const callerEnt = await callerEntitlement(ctx);

    let known: string[] = [];
    if (me?.role) {
      const others = seated
        .filter((p) => p.playerId !== playerId && p.role)
        .map((p) => ({ name: p.name, role: p.role as Role }));
      known = knownNames(me.role as Role, others, theme);
    }

    /* ----------------------------- plot cards --------------------------- */
    const hands = opts.plots ? await allHands(ctx, room._id) : [];
    const marks = opts.plots ? await marksOf(ctx, room._id) : [];
    const plotLog = opts.plots
      ? (await ctx.db.query("plotLog")
          .withIndex("by_room", (q) => q.eq("roomId", room._id))
          .collect())
          .sort((a, b) => a._creationTime - b._creationTime)
      : [];
    const mySecrets = me
      ? (await ctx.db.query("secrets")
          .withIndex("by_room_to", (q) => q.eq("roomId", room._id).eq("toId", playerId))
          .collect())
          .sort((a, b) => a._creationTime - b._creationTime)
      : [];

    // Who holds how many cards is public; WHICH cards is not.
    const handCounts: Record<string, number> = {};
    for (const h of hands) handCounts[h.playerId] = (handCounts[h.playerId] ?? 0) + 1;

    const chargedIds = marks.filter((m) => m.kind === "charge").map((m) => m.playerId);
    const calledOutIds = marks
      .filter((m) => m.kind === "revealCard" && m.questIndex === room.questIndex)
      .map((m) => m.playerId);

    // "Charge" makes a vote public the moment it is cast.
    const openVotes = votes
      .filter((x) => chargedIds.includes(x.playerId))
      .map((x) => ({ playerId: x.playerId, choice: x.choice }))
      .sort((a, b) => a.playerId.localeCompare(b.playerId));

    const kingReturnsHolders = hands
      .filter((h) => h.card === "king_returns")
      .map((h) => h.playerId);

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
      maxRejects: MAX_REJECTS,
      proposedTeam: room.proposedTeam,
      opts,
      setupErrors: validateSetup(Math.max(n, MIN_PLAYERS), opts),
      premium: {
        /** Is this room allowed to use paid content? */
        active: roomEnt.premium,
        seatCap: cap,
        ownerEmail: roomEnt.ownerEmail,
        expiresAt: roomEnt.expiresAt,
        /** Paid options currently switched on. */
        optsInUse: premiumOptsUsed(opts),
        themeIsPremium: isPremiumTheme(room.themeId),
        labels: PREMIUM_OPT_LABELS,
      },
      caller: {
        signedIn: callerEnt.signedIn,
        email: callerEnt.email,
        premium: callerEnt.premium,
        isAdmin: callerEnt.isAdmin,
        /** True when I am the host and my own plan is what unlocks this room. */
        iUnlockThisRoom:
          room.hostId === playerId && callerEnt.premium,
      },
      failsNeeded: failsNeeded(n, room.questIndex),
      lastVote: room.lastVote ?? null,
      lastQuest: room.lastQuest ?? null,
      winner: room.winner ?? null,
      winReason: room.winReason ?? null,
      assassinGuess: room.assassinGuess ?? null,
      assassinGuess2: room.assassinGuess2 ?? null,
      assassinMode: room.assassinMode ?? null,
      discussEndsAt: room.discussEndsAt ?? null,
      selectEndsAt: room.selectEndsAt ?? null,
      phaseEndsAt: room.phaseEndsAt ?? null,
      nightOrder: NIGHT_ORDER,

      /* --------------------------- Lancelot ---------------------------- */
      lancelot: opts.lancelot
        ? {
            swapped,
            log: (room.loyaltyLog ?? []).map((l) => ({
              questIndex: l.questIndex,
              card: l.card,
            })),
            remaining: (room.loyaltyDeck ?? []).length,
          }
        : null,

      /* ------------------------ Lady of the Lake ----------------------- */
      lady: opts.lady && n >= LADY_MIN_PLAYERS
        ? {
            holderId: room.ladyHolder ?? null,
            history: room.ladyHistory ?? [],
            last: room.lastLady
              ? {
                  ...room.lastLady,
                  holderName: nameOf(room.lastLady.holderId),
                  targetName: nameOf(room.lastLady.targetId),
                }
              : null,
          }
        : null,

      /* --------------------------- Excalibur --------------------------- */
      excalibur: opts.excalibur
        ? {
            holderId: room.excaliburHolder ?? null,
            last: room.lastExcalibur
              ? {
                  ...room.lastExcalibur,
                  holderName: nameOf(room.lastExcalibur.holderId),
                  targetName: room.lastExcalibur.targetId
                    ? nameOf(room.lastExcalibur.targetId)
                    : null,
                }
              : null,
          }
        : null,

      /* --------------------------- plot cards -------------------------- */
      plots: opts.plots
        ? {
            deckRemaining: (room.plotDeck ?? []).length,
            toDeal: (room.plotToDeal ?? []).length, // count only — dealt face down
            handCounts,
            chargedIds,
            calledOutIds,
            kingReturnsHolders,
            kingReturnsPassed: room.kingReturnsPassed ?? [],
            log: plotLog.map((l) => ({
              questIndex: l.questIndex,
              card: l.card,
              byName: nameOf(l.byId),
              targetName: l.targetId ? nameOf(l.targetId) : null,
            })),
            myHand: hands
              .filter((h) => h.playerId === playerId)
              .map((h) => ({
                id: h._id,
                card: h.card,
                def: PLOT_CARDS[h.card as PlotCardId],
              })),
          }
        : null,

      /** Private information delivered to me alone. */
      mySecrets: mySecrets.map((s) => ({
        kind: s.kind,
        questIndex: s.questIndex,
        subjectName: nameOf(s.subjectId),
        card: s.card ?? null,
        team: s.team ?? null,
      })),

      /**
       * The table. Ten at most — this is what the seal renders and what every
       * rule applies to.
       */
      players: seated.map((p) => ({
        playerId: p.playerId,
        name: p.name,
        seat: p.seat,
        isHost: p.playerId === room.hostId,
        role: ended ? p.role ?? null : null, // reveal only at end
        // Final allegiance matters at the reveal when a Lancelot has switched.
        team: ended && p.role ? currentTeam(p.role as Role, swapped) : null,
      })),
      /**
       * Everyone the table cannot fit, in a stable queue. They see the board and
       * hear voice, and never hold a role.
       */
      watchers: watching.map((p) => ({
        playerId: p.playerId,
        name: p.name,
        seat: p.seat,
        isHost: p.playerId === room.hostId,
      })),
      seating: {
        cap,
        seatedCount: seated.length,
        watcherCount: watching.length,
        overflowing,
        roomCapacity: ROOM_CAPACITY,
        iAmWatching,
      },
      me: me
        ? {
            playerId: me.playerId,
            name: me.name,
            seat: me.seat,
            role: me.role ?? null,
            team: me.role ? currentTeam(me.role as Role, swapped) : null,
            startingTeam: me.role ? ROLE_TEAM[me.role as Role] : null,
            allowedCards: me.role
              ? allowedQuestCards(me.role as Role, swapped)
              : (["success"] as QuestCard[]),
            nightStep: me.role ? nightStep(me.role as Role) : 0,
            isWatcher: iAmWatching,
            known,
          }
        : null,
      voteProgress: {
        voted: votes.length,
        total: seated.length,
        iVoted: votes.some((x) => x.playerId === playerId),
        openVotes,
      },
      questProgress: {
        submitted: cards.length,
        total: room.proposedTeam.length,
        iSubmitted: cards.some((x) => x.playerId === playerId),
      },
    };
  },
});
