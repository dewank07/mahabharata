/* ============================================================================
   Where the game is, in one row.

   This replaces a 288px column of four stacked blocks — a mission plate, the
   ladder under a sentence explaining it, the rejection track under another
   sentence explaining it, and a paragraph of win conditions re-rendered on
   every screen of every round. All four sentences were tutorial copy, and
   /learn and /rules both already carry them; the numbers are what a player
   glances at mid-turn, so the numbers are all that is left.

   Nothing here is stated twice: the mission NUMBER lives in the bar, the party
   SIZE lives in the primary button (propose) or in the list of who is riding
   (vote, quest), and "needs two fails" appears here only in the round where it
   is true.
   ========================================================================== */

import { QUEST_SIZES, doubleFailQuests } from "../../convex/logic";
import { MissionCoins } from "../TableParts";
import type { Room } from "./types";

export function StatusStrip({ room }: { room: Room }) {
  const n = room.players.length;
  const sizes = QUEST_SIZES[n] ?? [];
  const doubleFail = doubleFailQuests(n);
  const log = room.questLog ?? [];

  return (
    <div className="vd-strip">
      {/* The board. Number, party size, and the tally a ridden mission came
          back with — the same five facts the reckoning shows, from the same
          component, so the two can no longer drift. */}
      <MissionCoins
        sizes={sizes}
        questIndex={room.questIndex}
        results={room.questResults}
        doubleFail={doubleFail}
        log={log}
        /* The strip sits behind the unveil, so it is the surface that was
           giving quests away before the cards had been turned over. */
        holdUnrevealed
      />

      <div
        className="vd-strip__rejects"
        aria-label={`${room.rejectCount} of ${room.maxRejects} teams voted down in a row`}
      >
        {Array.from({ length: room.maxRejects }, (_, i) => (
          <i key={i} className={i < room.rejectCount ? "is-used" : undefined} />
        ))}
      </div>

      {/* Only in the rounds where it is true, and only because it changes what
          an evil player should actually do this turn. */}
      {room.failsNeeded > 1 && (
        <span className="vd-strip__warn">Needs {room.failsNeeded} fails</span>
      )}
    </div>
  );
}
