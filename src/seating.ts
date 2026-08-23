/* ============================================================================
   Seating — the 15-players-in-a-10-seat-room case.

   convex/logic.ts caps a game at MAX_PLAYERS = 10. Rather than refusing the
   11th arrival, the room keeps them: the first ten (by `players.seat`) are
   seated, everyone after that is a watcher in a stable queue.

   These are pure functions so they can live in convex/ and be re-used by the
   client. Server side, the only change needed is to stop rejecting joins past
   ten and to let the host swap a watcher for a seated player before start.
   ========================================================================== */

export const MAX_SEATED = 10; // MAX_PLAYERS in convex/logic.ts

export type RoomPlayer = { playerId: string; name: string; seat: number; inVoice?: boolean };

export type Seating = {
  seated: RoomPlayer[];
  watching: RoomPlayer[];
  /** true when the room is holding more people than the table can take */
  overflowing: boolean;
};

export function splitSeating(players: RoomPlayer[]): Seating {
  const ordered = [...players].sort((a, b) => a.seat - b.seat);
  const seated = ordered.slice(0, MAX_SEATED);
  const watching = ordered.slice(MAX_SEATED);
  return { seated, watching, overflowing: watching.length > 0 };
}

/**
 * Promote the first watcher into a freed seat. Call after a seated player
 * leaves; on the server this is a `patch` of the two `seat` values.
 */
export function promoteFirstWatcher(players: RoomPlayer[]): { playerId: string; seat: number } | null {
  const { seated, watching } = splitSeating(players);
  if (seated.length >= MAX_SEATED || watching.length === 0) return null;
  return { playerId: watching[0].playerId, seat: seated.length };
}

/** Host action: seat a specific watcher in place of a seated player. */
export function swapSeat(players: RoomPlayer[], watcherId: string, seatedId: string) {
  const w = players.find((p) => p.playerId === watcherId);
  const s = players.find((p) => p.playerId === seatedId);
  if (!w || !s) return null;
  return [
    { playerId: w.playerId, seat: s.seat },
    { playerId: s.playerId, seat: MAX_SEATED + Date.now() % 1000 }, // to the back of the queue
  ];
}
