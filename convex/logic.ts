// Pure, framework-agnostic Avalon rules. No Convex imports so it can be unit-tested
// and shared. Keep everything here DETERMINISTIC except buildRoles (only ever called
// inside a mutation, where randomness is allowed).

export type Role =
  | "merlin"
  | "percival"
  | "servant"
  | "assassin"
  | "morgana"
  | "mordred"
  | "oberon"
  | "minion";

export const TEAM_COUNTS: Record<number, [number, number]> = {
  5: [3, 2], 6: [4, 2], 7: [4, 3], 8: [5, 3], 9: [6, 3], 10: [6, 4],
};

export const QUEST_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3], 6: [2, 3, 4, 3, 4], 7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5], 9: [3, 4, 4, 5, 5], 10: [3, 4, 4, 5, 5],
};

export const DOUBLE_FAIL_QUEST = 3; // 4th quest needs 2 fails (only when players >= 7)

export const ROLE_TEAM: Record<Role, "good" | "evil"> = {
  merlin: "good", percival: "good", servant: "good",
  assassin: "evil", morgana: "evil", mordred: "evil", oberon: "evil", minion: "evil",
};

export type Opts = { percival: boolean; morgana: boolean; mordred: boolean; oberon: boolean };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Assign roles to players. Randomized — only call inside a mutation. */
export function buildRoles(playerIds: string[], opts: Opts): Record<string, Role> {
  const n = playerIds.length;
  const [good, evil] = TEAM_COUNTS[n];

  // Good side: Merlin is mandatory; Percival fills a slot if requested and one is free.
  const goodRoles: Role[] = ["merlin"];
  if (opts.percival && goodRoles.length < good) goodRoles.push("percival");
  while (goodRoles.length < good) goodRoles.push("servant");

  // Evil side: Assassin is mandatory; specials are added only while slots remain
  // (so over-selecting never crowds out the Assassin or unbalances the deck).
  const evilRoles: Role[] = ["assassin"];
  for (const r of ["morgana", "mordred", "oberon"] as Role[]) {
    if (opts[r as keyof Opts] && evilRoles.length < evil) evilRoles.push(r);
  }
  while (evilRoles.length < evil) evilRoles.push("minion");

  const deck = shuffle([...goodRoles, ...evilRoles]); // length === n by construction
  const roles: Record<string, Role> = {};
  shuffle(playerIds).forEach((id, i) => { roles[id] = deck[i]; });
  return roles;
}

/**
 * Names a given viewer is allowed to know. DETERMINISTIC (sorted), so it is safe
 * to call inside a reactive query. `others` excludes the viewer.
 */
export function knownNames(
  myRole: Role,
  others: { name: string; role: Role }[],
): string[] {
  let seen: { name: string; role: Role }[] = [];
  if (myRole === "merlin") {
    seen = others.filter((p) => ROLE_TEAM[p.role] === "evil" && p.role !== "mordred");
  } else if (myRole === "percival") {
    seen = others.filter((p) => p.role === "merlin" || p.role === "morgana");
  } else if (ROLE_TEAM[myRole] === "evil" && myRole !== "oberon") {
    seen = others.filter((p) => ROLE_TEAM[p.role] === "evil" && p.role !== "oberon");
  }
  return seen.map((p) => p.name).sort((a, b) => a.localeCompare(b));
}
