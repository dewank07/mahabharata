import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const role = v.union(
  v.literal("merlin"),
  v.literal("percival"),
  v.literal("servant"),
  v.literal("assassin"),
  v.literal("morgana"),
  v.literal("mordred"),
  v.literal("oberon"),
  v.literal("minion"),
);

export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    hostId: v.string(), // client-generated player session id
    phase: v.union(
      v.literal("lobby"),
      v.literal("reveal"),
      v.literal("propose"),
      v.literal("vote"),
      v.literal("quest"),
      v.literal("assassin"),
      v.literal("end"),
    ),
    leaderIndex: v.number(),
    roundId: v.number(),
    questIndex: v.number(),
    questResults: v.array(
      v.union(v.literal("success"), v.literal("fail"), v.null()),
    ),
    rejectCount: v.number(),
    proposedTeam: v.array(v.string()),
    opts: v.object({
      percival: v.boolean(),
      morgana: v.boolean(),
      mordred: v.boolean(),
      oberon: v.boolean(),
    }),
    lastVote: v.optional(
      v.object({
        roundId: v.number(),
        approved: v.boolean(),
        approvers: v.array(v.string()),
        rejecters: v.array(v.string()),
        team: v.array(v.string()),
      }),
    ),
    lastQuest: v.optional(
      v.object({
        questIndex: v.number(),
        fails: v.number(),
        success: v.boolean(),
        size: v.number(),
      }),
    ),
    winner: v.optional(v.union(v.literal("good"), v.literal("evil"))),
    winReason: v.optional(v.string()),
    assassinGuess: v.optional(v.string()),
  }).index("by_code", ["code"]),

  players: defineTable({
    roomId: v.id("rooms"),
    playerId: v.string(),
    name: v.string(),
    seat: v.number(),
    role: v.optional(role),
    inVoice: v.optional(v.boolean()),
  })
    .index("by_room", ["roomId"])
    .index("by_room_player", ["roomId", "playerId"]),

  // WebRTC signaling relay. Clients write offers/answers/ICE candidates here,
  // addressed to a specific peer, and delete them once consumed.
  signals: defineTable({
    roomId: v.id("rooms"),
    fromId: v.string(),
    toId: v.string(),
    kind: v.union(
      v.literal("offer"),
      v.literal("answer"),
      v.literal("candidate"),
    ),
    data: v.string(), // JSON-encoded SDP or ICE candidate
  })
    .index("by_room_to", ["roomId", "toId"]),

  votes: defineTable({
    roomId: v.id("rooms"),
    roundId: v.number(),
    playerId: v.string(),
    choice: v.union(v.literal("approve"), v.literal("reject")),
  }).index("by_room_round", ["roomId", "roundId"]),

  questCards: defineTable({
    roomId: v.id("rooms"),
    questIndex: v.number(),
    playerId: v.string(),
    card: v.union(v.literal("success"), v.literal("fail")),
  }).index("by_room_quest", ["roomId", "questIndex"]),
});
