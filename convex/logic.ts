// Pure, framework-agnostic Avalon rules. No Convex imports so it can be unit-tested
// and shared. Keep everything here DETERMINISTIC except the build*/shuffle helpers
// (only ever called inside a mutation, where randomness is allowed).
//
// Rules follow the Avalon wiki (avalon-game.com/wiki). Where the wiki states a
// deck SIZE but not its composition (plot cards), the choice is marked ENGINE CHOICE.
import { ThemeConfig } from "./themes";

/* ------------------------------- roles --------------------------------- */

export type Team = "good" | "evil";

export type Role =
  // good
  | "merlin"
  | "percival"
  | "guinevere"
  | "tristan"
  | "isolde"
  | "lancelot_good"
  | "servant"
  // evil
  | "assassin"
  | "morgana"
  | "mordred"
  | "oberon"
  | "lancelot_evil"
  | "minion";

export const ALL_ROLES: Role[] = [
  "merlin", "percival", "guinevere", "tristan", "isolde", "lancelot_good", "servant",
  "assassin", "morgana", "mordred", "oberon", "lancelot_evil", "minion",
];

/**
 * A role's STARTING allegiance. Note this is not necessarily a player's current
 * allegiance — the Lancelots can swap (see `currentTeam`). Merlin's night-phase
 * knowledge is deliberately based on this starting allegiance: per the wiki, Merlin
 * still perceives a formerly-evil Lancelot as evil after a loyalty change.
 */
export const ROLE_TEAM: Record<Role, Team> = {
  merlin: "good",
  percival: "good",
  guinevere: "good",
  tristan: "good",
  isolde: "good",
  lancelot_good: "good",
  servant: "good",
  assassin: "evil",
  morgana: "evil",
  mordred: "evil",
  oberon: "evil",
  lancelot_evil: "evil",
  minion: "evil",
};

/** Allegiance right now, accounting for a Lancelot loyalty swap. */
export function currentTeam(role: Role, lancelotSwapped: boolean): Team {
  if (lancelotSwapped) {
    if (role === "lancelot_good") return "evil";
    if (role === "lancelot_evil") return "good";
  }
  return ROLE_TEAM[role];
}

/* ------------------------------ setup matrix ---------------------------- */

export const TEAM_COUNTS: Record<number, [number, number]> = {
  5: [3, 2], 6: [4, 2], 7: [4, 3], 8: [5, 3], 9: [6, 3], 10: [6, 4],
};

export const QUEST_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3], 6: [2, 3, 4, 3, 4], 7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5], 9: [3, 4, 4, 5, 5], 10: [3, 4, 4, 5, 5],
};

/** The 4th quest (0-indexed 3) needs 2 fails — only at 7+ players. */
export const DOUBLE_FAIL_QUEST = 3;

export function failsNeeded(playerCount: number, questIndex: number): number {
  return questIndex === DOUBLE_FAIL_QUEST && playerCount >= 7 ? 2 : 1;
}

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;
export const MAX_REJECTS = 5;

/** Leader clock: discuss, then extra time to lock the war party. */
export const DISCUSS_MS = 3 * 60 * 1000;
export const SELECT_MS = 1 * 60 * 1000;

/**
 * Deadlines for the short expansion windows. Each one auto-resolves to the
 * do-nothing outcome so a disconnected player can never stall the table.
 */
export const PLOT_DEAL_MS = 90 * 1000;
export const KING_RETURNS_MS = 25 * 1000;
export const EXCALIBUR_MS = 45 * 1000;
export const LADY_MS = 60 * 1000;

/* --------------------------------- options ------------------------------ */

export type Opts = {
  // optional roles
  percival: boolean;
  morgana: boolean;
  mordred: boolean;
  oberon: boolean;
  guinevere: boolean;
  lovers: boolean; // Tristan + Isolde, always as a pair
  lancelot: boolean; // Good + Evil Lancelot, plus the loyalty deck
  // expansions
  lady: boolean; // Lady of the Lake (7+ players)
  excalibur: boolean;
  plots: boolean; // Plot cards
};

export const DEFAULT_OPTS: Opts = {
  percival: false, morgana: false, mordred: false, oberon: false,
  guinevere: false, lovers: false, lancelot: false,
  lady: false, excalibur: false, plots: false,
};

/**
 * Older rooms stored only the first four flags; fill the rest in. Coerces rather
 * than spreading, so an explicit `undefined` cannot clobber a default.
 */
export function normalizeOpts(raw: Partial<Opts> | undefined | null): Opts {
  const out = { ...DEFAULT_OPTS };
  for (const k of Object.keys(DEFAULT_OPTS) as (keyof Opts)[]) {
    out[k] = Boolean(raw?.[k]);
  }
  return out;
}

/* ------------------------------ free vs paid ----------------------------- */

/**
 * The free tier is a complete, fair game of Avalon: Merlin, the Assassin,
 * loyal servants, minions, Percival and Morgana, on the Medieval board.
 * Everything below is the paid tier.
 */
export const PREMIUM_OPT_KEYS: (keyof Opts)[] = [
  "mordred", "oberon", "guinevere", "lovers", "lancelot",
  "lady", "excalibur", "plots",
];

export const FREE_OPT_KEYS: (keyof Opts)[] = ["percival", "morgana"];

/** Boards included in the free tier. */
export const FREE_THEME_IDS = ["medieval"];

/** Player-facing names for the gated options, used in paywall copy. */
export const PREMIUM_OPT_LABELS: Record<string, string> = {
  mordred: "Mordred",
  oberon: "Oberon",
  guinevere: "Guinevere",
  lovers: "Tristan & Isolde",
  lancelot: "The Lancelots",
  lady: "Lady of the Lake",
  excalibur: "Excalibur",
  plots: "Plot cards",
};

export function isPremiumTheme(themeId: string): boolean {
  return !FREE_THEME_IDS.includes(themeId);
}

export function isPremiumOpt(key: string): boolean {
  return (PREMIUM_OPT_KEYS as string[]).includes(key);
}

/** Which paid options a given setup is asking for. */
export function premiumOptsUsed(opts: Opts): (keyof Opts)[] {
  return PREMIUM_OPT_KEYS.filter((k) => opts[k]);
}

/** Turn every paid option off — used to sanitize a free-tier room. */
export function stripPremiumOpts(opts: Opts): Opts {
  const out = { ...opts };
  for (const k of PREMIUM_OPT_KEYS) out[k] = false;
  return out;
}

/** Human-readable reason a free-tier room cannot use this setup. Null if fine. */
export function premiumBlockReason(
  themeId: string,
  opts: Opts,
): string | null {
  const used = premiumOptsUsed(opts);
  if (used.length > 0) {
    const names = used.map((k) => PREMIUM_OPT_LABELS[k] ?? k).join(", ");
    return `${names} ${used.length === 1 ? "is" : "are"} part of the premium tier.`;
  }
  if (isPremiumTheme(themeId)) {
    return "That world is part of the premium tier.";
  }
  return null;
}

/** How many players a room may seat, given its premium standing. */
export function seatCap(premium: boolean, seats: number): number {
  if (!premium) return MAX_PLAYERS;
  return Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, seats));
}

/** How many good/evil slots the optional roles consume. */
const GOOD_SLOT_COST = { percival: 1, guinevere: 1, lovers: 2, lancelot: 1 } as const;
const EVIL_SLOT_COST = { morgana: 1, mordred: 1, oberon: 1, lancelot: 1 } as const;

/**
 * Human-readable reasons a setup is illegal. Empty array === legal.
 * Used by the lobby (to disable Start) and re-checked server-side on start.
 */
export function validateSetup(playerCount: number, opts: Opts): string[] {
  const errs: string[] = [];
  if (playerCount < MIN_PLAYERS) {
    errs.push(`Need at least ${MIN_PLAYERS} players.`);
    return errs;
  }
  if (playerCount > MAX_PLAYERS) {
    errs.push(`At most ${MAX_PLAYERS} players.`);
    return errs;
  }
  const [good, evil] = TEAM_COUNTS[playerCount];

  // Merlin and the Assassin are mandatory, so one slot on each side is spoken for.
  let goodUsed = 1;
  let evilUsed = 1;
  for (const [k, cost] of Object.entries(GOOD_SLOT_COST)) {
    if (opts[k as keyof Opts]) goodUsed += cost;
  }
  for (const [k, cost] of Object.entries(EVIL_SLOT_COST)) {
    if (opts[k as keyof Opts]) evilUsed += cost;
  }
  if (goodUsed > good) {
    errs.push(
      `Too many good roles: ${goodUsed} needed but only ${good} good seats at ${playerCount} players.`,
    );
  }
  if (evilUsed > evil) {
    errs.push(
      `Too many evil roles: ${evilUsed} needed but only ${evil} evil seats at ${playerCount} players.`,
    );
  }
  if (opts.guinevere && !opts.lancelot) {
    errs.push("Guinevere only sees the Lancelots — enable Lancelot too.");
  }
  if (opts.percival && !opts.morgana) {
    errs.push("Percival needs Morgana to be a real choice — enable Morgana too.");
  }
  if (opts.lady && playerCount < LADY_MIN_PLAYERS) {
    errs.push(`Lady of the Lake needs ${LADY_MIN_PLAYERS}+ players.`);
  }
  return errs;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Assign roles to players. Randomized — only call inside a mutation.
 * Assumes `validateSetup` already passed; it still degrades safely by dropping
 * optional roles that do not fit rather than ever returning a wrong-sized deck.
 */
export function buildRoles(playerIds: string[], opts: Opts): Record<string, Role> {
  const n = playerIds.length;
  const [good, evil] = TEAM_COUNTS[n];

  // Merlin and the Assassin are always in play.
  const goodRoles: Role[] = ["merlin"];
  const evilRoles: Role[] = ["assassin"];

  // Lancelot takes one slot on each side, so it has to fit on both or not at all.
  if (opts.lancelot && goodRoles.length < good && evilRoles.length < evil) {
    goodRoles.push("lancelot_good");
    evilRoles.push("lancelot_evil");
  }
  // The lovers are a pair — two good slots or neither.
  if (opts.lovers && goodRoles.length + 2 <= good) {
    goodRoles.push("tristan", "isolde");
  }
  if (opts.percival && goodRoles.length < good) goodRoles.push("percival");
  // Guinevere is pointless without Lancelots to watch.
  if (opts.guinevere && goodRoles.includes("lancelot_good") && goodRoles.length < good) {
    goodRoles.push("guinevere");
  }
  while (goodRoles.length < good) goodRoles.push("servant");

  for (const r of ["morgana", "mordred", "oberon"] as const) {
    if (opts[r] && evilRoles.length < evil) evilRoles.push(r);
  }
  while (evilRoles.length < evil) evilRoles.push("minion");

  const deck = shuffle([...goodRoles, ...evilRoles]); // length === n by construction
  const roles: Record<string, Role> = {};
  shuffle(playerIds).forEach((id, i) => {
    roles[id] = deck[i];
  });
  return roles;
}

/* ------------------------------ quest cards ----------------------------- */

export type QuestCard = "success" | "fail";

/**
 * Which mission cards a player is allowed to play. The server clamps to this, so
 * a tampered client cannot smuggle a Fail out of a loyal servant.
 *
 * Per the wiki the Lancelots are *forced*: Evil Lancelot may only fail, Good
 * Lancelot may only succeed — and that follows the loyalty swap.
 */
export function allowedQuestCards(role: Role, lancelotSwapped: boolean): QuestCard[] {
  if (role === "lancelot_good" || role === "lancelot_evil") {
    return currentTeam(role, lancelotSwapped) === "evil" ? ["fail"] : ["success"];
  }
  return ROLE_TEAM[role] === "evil" ? ["success", "fail"] : ["success"];
}

/** Clamp a requested card to something this role may legally play. */
export function clampQuestCard(
  role: Role | undefined,
  lancelotSwapped: boolean,
  requested: QuestCard,
): QuestCard {
  if (!role) return "success";
  const allowed = allowedQuestCards(role, lancelotSwapped);
  return allowed.includes(requested) ? requested : allowed[0];
}

/* ---------------------------- loyalty (Lancelot) ------------------------ */

export type LoyaltyCard = "switch" | "blank";

/** Five cards: two switch allegiance, three do nothing. */
export const LOYALTY_DECK: LoyaltyCard[] = [
  "switch", "switch", "blank", "blank", "blank",
];

export function buildLoyaltyDeck(): LoyaltyCard[] {
  return shuffle(LOYALTY_DECK);
}

/** First quest (0-indexed) whose round begins with a loyalty draw: round 3. */
export const LOYALTY_FIRST_QUEST_INDEX = 2;

export function drawsLoyaltyThisRound(questIndex: number, lancelotEnabled: boolean): boolean {
  return lancelotEnabled && questIndex >= LOYALTY_FIRST_QUEST_INDEX;
}

/* --------------------------- Lady of the Lake --------------------------- */

export const LADY_MIN_PLAYERS = 7;

/**
 * The Lady is used after quests 2, 3 and 4 (0-indexed 1, 2, 3) — never after the
 * final quest, since the game is already decided by then.
 */
export function ladyActiveAfterQuest(questIndex: number): boolean {
  return questIndex >= 1 && questIndex <= 3;
}

/* ------------------------------ plot cards ------------------------------ */

export type PlotCardId =
  | "lead_to_victory"
  | "ambush"
  | "king_returns"
  | "we_found_you"
  | "restore_honor"
  | "show_strength"
  | "show_true_nature"
  | "are_you_the_one"
  | "charge";

/**
 * `instant` cards resolve the moment they are handed over; `usable` cards are held
 * and played inside a specific window; `effect` cards stay on a player for the
 * rest of the game.
 */
export type PlotKind = "usable" | "instant" | "effect";

/** The window in which a `usable` card may be played. */
export type PlotWindow = "propose" | "vote" | "quest" | "kingReturns" | "none";

export type PlotCardDef = {
  id: PlotCardId;
  kind: PlotKind;
  window: PlotWindow;
  /** Does playing it require picking a target player? */
  needsTarget: boolean;
  name: string;
  desc: string;
};

export const PLOT_CARDS: Record<PlotCardId, PlotCardDef> = {
  lead_to_victory: {
    id: "lead_to_victory",
    kind: "usable",
    window: "propose",
    needsTarget: false,
    name: "Lead to Victory",
    desc: "Seize leadership: you become the leader and propose this round's party.",
  },
  ambush: {
    id: "ambush",
    kind: "usable",
    window: "quest",
    needsTarget: true,
    name: "Ambush",
    desc: "Secretly examine one party member's played mission card. Nobody is told. One target per player per mission.",
  },
  king_returns: {
    id: "king_returns",
    kind: "usable",
    window: "kingReturns",
    needsTarget: false,
    name: "King Returns",
    desc: "Overturn an approved party. It counts as a rejected vote and advances the rejection track.",
  },
  we_found_you: {
    id: "we_found_you",
    kind: "usable",
    window: "vote",
    needsTarget: true,
    name: "We Found You",
    desc: "Announce now that one party member must reveal their mission card publicly when the quest resolves.",
  },
  restore_honor: {
    id: "restore_honor",
    kind: "instant",
    window: "none",
    needsTarget: true,
    name: "Restore Your Honor",
    desc: "Take one plot card from another player.",
  },
  show_strength: {
    id: "show_strength",
    kind: "instant",
    window: "none",
    needsTarget: false,
    name: "Show Your Strength",
    desc: "The leader shows you their loyalty card. You alone see it.",
  },
  show_true_nature: {
    id: "show_true_nature",
    kind: "instant",
    window: "none",
    needsTarget: true,
    name: "Show Your True Nature",
    desc: "You must show your own loyalty card to a player of your choosing.",
  },
  are_you_the_one: {
    id: "are_you_the_one",
    kind: "instant",
    window: "none",
    needsTarget: true,
    name: "Are You the One?",
    desc: "Check the loyalty of one player seated next to you.",
  },
  charge: {
    id: "charge",
    kind: "effect",
    window: "none",
    needsTarget: false,
    name: "Charge",
    desc: "For the rest of the game your vote is revealed before everyone else's.",
  },
};

/** Cards dealt at the start of each round, by player count (wiki). */
export function plotCardsPerRound(playerCount: number): number {
  if (playerCount <= 6) return 1;
  if (playerCount <= 8) return 2;
  return 3;
}

/**
 * ENGINE CHOICE. The wiki fixes deck SIZE (7 cards at 5–6 players, 15 at 7–10) and
 * the full card list with copy counts, but not which subset makes up the small deck.
 * These compositions keep every card type reachable while hitting the stated sizes.
 */
const PLOT_DECK_SMALL: PlotCardId[] = [
  "lead_to_victory", "ambush", "king_returns", "we_found_you",
  "restore_honor", "are_you_the_one", "charge",
]; // 7 cards, 5 dealt over 5 rounds

const PLOT_DECK_LARGE: PlotCardId[] = [
  "lead_to_victory", "lead_to_victory",
  "ambush", "ambush",
  "king_returns", "king_returns", "king_returns",
  "we_found_you", "we_found_you",
  "restore_honor",
  "show_strength",
  "show_true_nature",
  "are_you_the_one", "are_you_the_one",
  "charge",
]; // 15 cards

export function buildPlotDeck(playerCount: number): PlotCardId[] {
  return shuffle(playerCount <= 6 ? PLOT_DECK_SMALL : PLOT_DECK_LARGE);
}

/* ------------------------------ night phase ----------------------------- */

/**
 * The order the wiki resolves night visions in. The UI walks this so the reveal
 * reads like the tabletop script instead of everything landing at once.
 */
export const NIGHT_ORDER: Array<{ step: number; roles: Role[]; label: string }> = [
  { step: 1, roles: ["assassin", "morgana", "mordred", "minion"], label: "The servants of evil know one another" },
  { step: 2, roles: ["guinevere"], label: "Guinevere marks the two Lancelots" },
  { step: 3, roles: ["merlin"], label: "Merlin perceives the servants of evil" },
  { step: 4, roles: ["percival"], label: "Percival beholds Merlin and Morgana" },
  { step: 5, roles: ["tristan", "isolde"], label: "The lovers find each other" },
];

/** Which night step a viewer's own reveal happens on (0 = no vision). */
export function nightStep(role: Role): number {
  const found = NIGHT_ORDER.find((s) => s.roles.includes(role));
  return found ? found.step : 0;
}

/* ----------------------------- knowledge -------------------------------- */

/**
 * Names a given viewer is allowed to know. DETERMINISTIC (sorted), so it is safe
 * to call inside a reactive query. `others` excludes the viewer.
 *
 * Deliberately driven off the theme's declared abilities and off STARTING
 * allegiance — night knowledge is a snapshot and a later Lancelot swap does not
 * retroactively rewrite what Merlin was shown.
 */
export function knownNames(
  myRole: Role,
  others: { name: string; role: Role }[],
  theme: ThemeConfig,
): string[] {
  const roleDef = theme.roles.find((r) => r.id === myRole);
  if (!roleDef) return [];

  const revealAbility = roleDef.abilities.find((a) => a.type === "reveal");
  if (!revealAbility) return [];

  const target = revealAbility.target;
  if (!target) return [];

  let seen: { name: string; role: Role }[] = [];

  if (target.roles) {
    seen = others.filter((p) => target.roles!.includes(p.role));
  } else if (target.team) {
    seen = others.filter((p) => {
      const pDef = theme.roles.find((r) => r.id === p.role);
      return pDef?.team === target.team;
    });
  }

  if (target.excludeRoles) {
    seen = seen.filter((p) => !target.excludeRoles!.includes(p.role));
  }

  return seen.map((p) => p.name).sort((a, b) => a.localeCompare(b));
}
