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
import type { Room } from "./types";

export function StatusStrip({ room }: { room: Room }) {
  const n = room.players.length;
  const sizes = QUEST_SIZES[n] ?? [];
  const doubleFail = doubleFailQuests(n);
  const log = room.questLog ?? [];

  return (
    <div className="vd-strip">
      <div className="vd-strip__ladder" role="group" aria-label="The five missions">
        {sizes.map((size, i) => {
          const result = room.questResults[i];
          const active = i === room.questIndex;
          const tally = log.find((q) => q.questIndex === i);
          const twoFails = doubleFail.includes(i);
          return (
            <span
              key={i}
              className={[
                "vd-slot",
                active ? "is-active" : "",
                result === "fail" ? "is-fail" : "",
                result === "success" ? "is-held" : "",
              ].filter(Boolean).join(" ")}
              aria-label={
                tally
                  ? `Mission ${i + 1}: ${tally.successes} succeeded, ${tally.fails} failed`
                  : `Mission ${i + 1}: ${size} people go${twoFails ? ", needs two fails" : ""}`
              }
            >
              {/* One face. A coin that has been decided shows the verdict as a
                  mark; one still to come shows how many ride. The tally that
                  used to sit here does not fit on a struck coin and is a
                  number the table argues about later, not mid-turn — it is in
                  the ledger behind the info sheet, and in the aria-label. */}
              <span className="vd-slot__face" aria-hidden>
                {result === "success" ? "\u2726" : result === "fail" ? "\u2715" : size}
              </span>
              {twoFails && <span className="vd-slot__dbl" aria-hidden />}
            </span>
          );
        })}
      </div>

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
