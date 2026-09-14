/* ============================================================================
   What the board is not allowed to say yet.

   A quest resolves on the server in one write: `questResults` and `questLog`
   both land at once, and every subscriber repaints from them immediately. That
   is correct for the data and wrong for the drama — the unveil is still on
   screen with the cards face down while the mission coin behind it has already
   turned red and printed "0–2". `RevealCeremony` solved exactly this problem
   inside its own plate ("Eight players watched the border turn red while the
   cards were still face down"); this is the same fix for everything outside
   it.

   So: a quest whose unveil is queued or on screen is HELD, and anything
   drawing the mission board renders it as though it had not ridden yet. The
   hold is released when the player dismisses that unveil — the moment they
   have actually been shown the result.

   A module-level store rather than a context, because the two ends are far
   apart in the tree (`App` renders the ceremony; `StatusStrip` is mounted by
   each phase screen, five levels down) and threading a prop through every
   screen to carry one number is a worse trade than one subscription.

   Nothing here is security: a determined player can read the websocket. It is
   pacing, for the same reason the unveil exists at all.
   ========================================================================== */

import { useSyncExternalStore } from "react";

/** Quest indices whose unveil has not been dismissed on THIS client yet. */
let held: ReadonlySet<number> = new Set();

const listeners = new Set<() => void>();

/* A new Set identity on every change, never a mutation: `useSyncExternalStore`
   compares snapshots by reference, so mutating in place would be invisible. */
function commit(next: Set<number>) {
  held = next;
  for (const fn of listeners) fn();
}

export function holdQuest(questIndex: number): void {
  if (held.has(questIndex)) return;
  commit(new Set(held).add(questIndex));
}

export function releaseQuest(questIndex: number): void {
  if (!held.has(questIndex)) return;
  const next = new Set(held);
  next.delete(questIndex);
  commit(next);
}

/**
 * Drop every hold.
 *
 * For leaving a room and for a new game: holds are keyed by quest INDEX, which
 * restarts at 0, so a hold left over from the previous game would blank the
 * first mission of the next one.
 */
export function clearHolds(): void {
  if (held.size === 0) return;
  commit(new Set());
}

const snapshot = () => held;
/* The prerender has no client and no unveils; an empty set is the honest
   answer there and keeps the server and first client render agreeing. */
const EMPTY: ReadonlySet<number> = new Set();

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The quests this client must still draw as un-ridden. */
export function useHeldQuests(): ReadonlySet<number> {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
