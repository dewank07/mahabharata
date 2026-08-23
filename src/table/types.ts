/* ============================================================================
   Shared types for the Council Seal table.

   The room shape is DERIVED from the Convex query rather than hand-declared, so
   the screens can never drift from `convex/avalon.ts:getRoom`. The design
   handoff's `ProposeScreen` used a hand-written `RoomView`; this replaces it.
   ========================================================================== */

import type { FunctionReturnType } from "convex/server";
import type { useVoice } from "../useVoice";
import { api } from "../../convex/_generated/api";

export type Room = NonNullable<FunctionReturnType<typeof api.avalon.getRoom>>;

/** Someone at the table. Ten at most. */
export type TablePlayer = Room["players"][number];
/** Someone in the room but not in the game. */
export type Watcher = Room["watchers"][number];

export type Voice = ReturnType<typeof useVoice>;

/** Everything every screen needs. Screens stay presentational; App owns the actions. */
export type TableProps = {
  room: Room;
  /** My anonymous per-tab player id. */
  pid: string;
  /** Themed role names / lore. The palette is fixed — themes no longer colour the board. */
  theme: { name: string; goodTeamName: string; evilTeamName: string };
  voice: Voice;
  emblemSrc: string;
  /** Wraps a mutation so errors surface in one place. */
  act: (fn: () => Promise<unknown>) => () => void;
  error: string;
};

export const ROMAN = ["I", "II", "III", "IV", "V"];

/** Sigils are dealt from playerId, so they are stable without any schema change. */
export function nameOf(room: Room, playerId: string | null | undefined): string {
  if (!playerId) return "—";
  return (
    room.players.find((p) => p.playerId === playerId)?.name ??
    room.watchers.find((p) => p.playerId === playerId)?.name ??
    "—"
  );
}

/** The player holding the seal this round, or null before the game starts. */
export function leaderOf(room: Room): TablePlayer | null {
  return room.players[room.leaderIndex] ?? null;
}

export function isLeader(room: Room, pid: string): boolean {
  return leaderOf(room)?.playerId === pid;
}

/** How many riders this quest needs. */
export function partySize(room: Room): number {
  const n = room.players.length;
  const sizes: Record<number, number[]> = {
    5: [2, 3, 2, 3, 3], 6: [2, 3, 4, 3, 4], 7: [2, 3, 3, 4, 4],
    8: [3, 4, 4, 5, 5], 9: [3, 4, 4, 5, 5], 10: [3, 4, 4, 5, 5],
  };
  return sizes[n]?.[room.questIndex] ?? 0;
}
