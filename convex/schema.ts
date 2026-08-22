import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const role = v.union(
  // good
  v.literal("merlin"),
  v.literal("percival"),
  v.literal("guinevere"),
  v.literal("tristan"),
  v.literal("isolde"),
  v.literal("lancelot_good"),
  v.literal("servant"),
  // evil
  v.literal("assassin"),
  v.literal("morgana"),
  v.literal("mordred"),
  v.literal("oberon"),
  v.literal("lancelot_evil"),
  v.literal("minion"),
);

const plotCard = v.union(
  v.literal("lead_to_victory"),
  v.literal("ambush"),
  v.literal("king_returns"),
  v.literal("we_found_you"),
  v.literal("restore_honor"),
  v.literal("show_strength"),
  v.literal("show_true_nature"),
  v.literal("are_you_the_one"),
  v.literal("charge"),
);

const team = v.union(v.literal("good"), v.literal("evil"));

// Optional roles + expansions the host toggles in the lobby. Everything past the
// first four is optional so rooms created before the expansions still validate.
const opts = v.object({
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

const plan = v.union(v.literal("monthly"), v.literal("yearly"));

export default defineSchema({
  // users / authSessions / authAccounts / authRefreshTokens / authVerifiers ...
  ...authTables,

  /**
   * A paid plan covering `seats` people. Premium content unlocks for any email
   * holding a seat on an `active`, unexpired subscription.
   */
  subscriptions: defineTable({
    ownerUserId: v.id("users"),
    ownerEmail: v.string(),
    plan,
    seats: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("revoked"),
      v.literal("expired"),
    ),
    startedAt: v.number(),
    expiresAt: v.number(),
    orderId: v.optional(v.id("orders")),
    adminNote: v.optional(v.string()),
  })
    .index("by_owner", ["ownerUserId"])
    .index("by_status", ["status"]),

  /** One row per covered email. Lower-cased so lookups are exact. */
  seats: defineTable({
    subscriptionId: v.id("subscriptions"),
    email: v.string(),
  })
    .index("by_email", ["email"])
    .index("by_subscription", ["subscriptionId"]),

  /**
   * A purchase request. The buyer pays by UPI QR out of band and records the
   * reference here; an admin then approves it, which mints the subscription.
   */
  orders: defineTable({
    userId: v.id("users"),
    email: v.string(),
    name: v.string(),
    plan,
    seats: v.number(),
    /** Snapshotted at submission so a later price change cannot rewrite history. */
    amountInr: v.number(),
    /** Emails the buyer wants covered, including their own. */
    memberEmails: v.array(v.string()),
    /** UPI transaction / UTR reference the buyer pasted in. */
    paymentRef: v.string(),
    note: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("cancelled"),
    ),
    createdAt: v.number(),
    reviewedAt: v.optional(v.number()),
    reviewedByEmail: v.optional(v.string()),
    adminNote: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_user", ["userId"]),

  rooms: defineTable({
    code: v.string(),
    themeId: v.string(),
    hostId: v.string(), // client-generated player session id
    /**
     * Set when the host was signed in. The room's premium entitlement is read
     * from this account, so guests can still join without an account.
     */
    hostUserId: v.optional(v.id("users")),
    phase: v.union(
      v.literal("lobby"),
      v.literal("reveal"),
      v.literal("plot"), // leader hands out this round's plot cards
      v.literal("propose"),
      v.literal("vote"),
      v.literal("kingReturns"), // window to overturn an approved party
      v.literal("quest"),
      v.literal("excalibur"), // holder may flip one mission card
      v.literal("lady"), // Lady of the Lake inspection
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
    opts,
    lastVote: v.optional(
      v.object({
        roundId: v.number(),
        approved: v.boolean(),
        approvers: v.array(v.string()),
        rejecters: v.array(v.string()),
        team: v.array(v.string()),
        overturnedBy: v.optional(v.string()), // King Returns was played
      }),
    ),
    lastQuest: v.optional(
      v.object({
        questIndex: v.number(),
        fails: v.number(),
        success: v.boolean(),
        size: v.number(),
        // Cards forced public by "We Found You".
        revealed: v.optional(
          v.array(
            v.object({
              playerId: v.string(),
              card: v.union(v.literal("success"), v.literal("fail")),
            }),
          ),
        ),
      }),
    ),
    winner: v.optional(team),
    winReason: v.optional(v.string()),
    assassinGuess: v.optional(v.string()),
    // Assassin may name the lovers instead of Merlin when they are in play.
    assassinMode: v.optional(v.union(v.literal("merlin"), v.literal("lovers"))),
    assassinGuess2: v.optional(v.string()),
    discussEndsAt: v.optional(v.number()),
    selectEndsAt: v.optional(v.number()),
    /** Deadline for the short expansion windows (plot/kingReturns/excalibur/lady). */
    phaseEndsAt: v.optional(v.number()),

    /* ------------------------------ Lancelot ----------------------------- */
    lancelotSwapped: v.optional(v.boolean()),
    loyaltyDeck: v.optional(
      v.array(v.union(v.literal("switch"), v.literal("blank"))),
    ),
    loyaltyLog: v.optional(
      v.array(
        v.object({
          questIndex: v.number(),
          card: v.union(v.literal("switch"), v.literal("blank")),
        }),
      ),
    ),

    /* -------------------------- Lady of the Lake ------------------------- */
    ladyHolder: v.optional(v.string()),
    /** Everyone who has ever held it — they can never be inspected again. */
    ladyHistory: v.optional(v.array(v.string())),
    /** Public record of who inspected whom (never the result). */
    lastLady: v.optional(
      v.object({
        questIndex: v.number(),
        holderId: v.string(),
        targetId: v.string(),
      }),
    ),

    /* ------------------------------ Excalibur ---------------------------- */
    excaliburHolder: v.optional(v.string()),
    /** Public: who it was used on. Never what the card was before. */
    lastExcalibur: v.optional(
      v.object({
        questIndex: v.number(),
        holderId: v.string(),
        targetId: v.optional(v.string()),
        used: v.boolean(),
      }),
    ),

    /* ------------------------------ Plot cards --------------------------- */
    plotDeck: v.optional(v.array(plotCard)),
    /** Cards the leader still has to hand out this round. */
    plotToDeal: v.optional(v.array(plotCard)),
    /** Holders who declined to play King Returns in the current window. */
    kingReturnsPassed: v.optional(v.array(v.string())),
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
    /** Set when Excalibur flipped this card. */
    flipped: v.optional(v.boolean()),
  }).index("by_room_quest", ["roomId", "questIndex"]),

  /* --------------------------- plot card state ------------------------- */

  // One row per plot card currently in a player's hand.
  plotHands: defineTable({
    roomId: v.id("rooms"),
    playerId: v.string(),
    card: plotCard,
    dealtQuest: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_player", ["roomId", "playerId"]),

  // Public log of plot cards that have been played.
  plotLog: defineTable({
    roomId: v.id("rooms"),
    questIndex: v.number(),
    card: plotCard,
    byId: v.string(),
    targetId: v.optional(v.string()),
  }).index("by_room", ["roomId"]),

  // Standing marks a plot card left on a player: a permanent "Charge" effect, or a
  // "We Found You" order to reveal one mission card publicly.
  plotMarks: defineTable({
    roomId: v.id("rooms"),
    playerId: v.string(),
    kind: v.union(v.literal("charge"), v.literal("revealCard")),
    questIndex: v.optional(v.number()), // revealCard applies to this quest only
  }).index("by_room", ["roomId"]),

  // Information delivered to exactly one player: an Ambush peek, a Lady of the Lake
  // result, or a loyalty card shown by a plot card. Only ever read by `toId`.
  secrets: defineTable({
    roomId: v.id("rooms"),
    toId: v.string(),
    questIndex: v.number(),
    kind: v.union(
      v.literal("ambush"),
      v.literal("lady"),
      v.literal("loyalty"),
    ),
    subjectId: v.string(), // whose information this is
    card: v.optional(v.union(v.literal("success"), v.literal("fail"))),
    team: v.optional(team),
  }).index("by_room_to", ["roomId", "toId"]),
});
