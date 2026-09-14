/* ============================================================================
   04 · The vote, and the verdict.

   Votes are simultaneous and hidden: a brass stud on a seat means that player
   has voted, never how.

   The two buttons come before the seal here. The seal is worth having — it is
   how you see the votes landing — but it is 340px of it, and on a phone it was
   sitting between the question and the answer.

   Gone: a mission column, a ledger column, "Should this team go? — 0 of 5
   voted" restating the bar, and the trailing "More yes votes than no and the
   team goes…" that the two buttons already say in their own notes. The voted
   and watching states show nothing here at all, because the bar has already
   said what they are waiting for.
   ========================================================================== */

import { Check, Crown, X } from "lucide-react";
import { Plate } from "../TableParts";
import { SeatRing } from "./Parts";
import { StatusStrip } from "./StatusStrip";
import { Riders } from "./ProposeScreen";
import { type TableProps, nameOf } from "./types";

export function VoteScreen({
  room, pid, emblemSrc, act, onVote,
}: Pick<TableProps, "room" | "pid" | "emblemSrc" | "act"> & {
  onVote: (choice: "approve" | "reject") => Promise<unknown>;
}) {
  const voted = room.voteProgress.iVoted;
  const open = room.voteProgress.openVotes ?? [];
  const canVote = !voted && !room.seating.iAmWatching;

  return (
    <div className="vd-play">
      <StatusStrip room={room} />
      <Riders room={room} />

      {canVote && (
        <div className="vd-actionbar">
          <div className="vd-cards">
            <button className="vd-card vd-card--success" onClick={act(() => onVote("approve"))}>
              <Check size={20} />
              <span className="vd-card__name">Yes</span>
              <span className="vd-card__note">Send this team on the mission</span>
            </button>
            <button className="vd-card vd-card--fail" onClick={act(() => onVote("reject"))}>
              <X size={20} />
              <span className="vd-card__name">No</span>
              <span className="vd-card__note">Make someone else pick a team</span>
            </button>
          </div>
        </div>
      )}

      <SeatRing
        room={room}
        emblemSrc={emblemSrc}
        // A brass ring means a vote is in. It never says which way.
        stateFor={(p) => {
          if (room.proposedTeam.includes(p.playerId)) return "named";
          const cast = open.find((o) => o.playerId === p.playerId);
          if (cast) return "voted";
          return p.playerId === room.players[room.leaderIndex]?.playerId ? "leader" : "idle";
        }}
        noteFor={(p) => {
          const cast = open.find((o) => o.playerId === p.playerId);
          // Only a Charge plot card makes a vote public before the count.
          if (cast) return cast.choice === "approve" ? "Voted yes" : "Voted no";
          return room.proposedTeam.includes(p.playerId) ? "On the team" : undefined;
        }}
      />
    </div>
  );
}

/**
 * 04b · The King Returns window — an approved party can still be overturned by
 * whoever holds that plot card.
 */
export function KingReturnsScreen({
  room, pid, act, onPlay, onPass,
}: Pick<TableProps, "room" | "pid" | "act"> & {
  onPlay: () => Promise<unknown>;
  onPass: () => Promise<unknown>;
}) {
  const holders = room.plots?.kingReturnsHolders ?? [];
  const passed = room.plots?.kingReturnsPassed ?? [];
  const mine = holders.includes(pid) && !passed.includes(pid);

  return (
    <Plate
      eyebrow="The team was approved"
      title={mine ? "Cancel this team?" : "Waiting on a plot card"}
      action={
        mine ? (
          <div className="vd-cards">
            <button className="vd-card vd-card--fail" onClick={act(onPlay)}>
              <Crown size={18} />
              <span className="vd-card__name">Cancel it</span>
              <span className="vd-card__note">Counts as a rejected team</span>
            </button>
            <button className="vd-card vd-card--success" onClick={act(onPass)}>
              <Check size={18} />
              <span className="vd-card__name">Let it go</span>
              <span className="vd-card__note">Keep your card</span>
            </button>
          </div>
        ) : (
          <p className="vd-hint" style={{ textAlign: "center" }}>
            {passed.length} of {holders.length} have let it go ahead.
          </p>
        )
      }
    >
      <p className="vd-voice" style={{ marginTop: 12, textAlign: "center" }}>
        {room.proposedTeam.map((id) => nameOf(room, id)).join(", ")}
      </p>
    </Plate>
  );
}
