/* ============================================================================
   04 · The vote, and the verdict.

   Votes are simultaneous and hidden: a brass stud on a seat means that player
   has voted, never how. The verdict arrives as a studded plate.
   ========================================================================== */

import { Check, Crown, X } from "lucide-react";
import { Plate } from "../TableParts";
import { QuestColumn, ChronicleColumn, SeatRing } from "./Parts";
import { ActionLine } from "./TableShell";
import { Riders } from "./ProposeScreen";
import { type TableProps, nameOf } from "./types";

export function VoteScreen({
  room, pid, emblemSrc, act, onVote,
}: Pick<TableProps, "room" | "pid" | "emblemSrc" | "act"> & {
  onVote: (choice: "approve" | "reject") => Promise<unknown>;
}) {
  const voted = room.voteProgress.iVoted;
  const open = room.voteProgress.openVotes ?? [];
  const iAmWatching = room.seating.iAmWatching;

  return (
    <div className="vd-table vd-table-layout">
      <QuestColumn room={room} />

      <div className="vd-centre">
        <div className="vd-centre__wide">
          <Riders room={room} />
        </div>

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
            if (cast) return cast.choice === "approve" ? "For · charge" : "Against · charge";
            return room.proposedTeam.includes(p.playerId) ? "Riding" : undefined;
          }}
        />

        <div className="vd-centre__wide vd-actionbar">
          {iAmWatching ? (
            <div className="vd-panel">
              <p className="vd-voice" style={{ margin: 0 }}>
                You are watching this table. The vote is not yours to cast.
              </p>
            </div>
          ) : !voted ? (
            <>
              <ActionLine
                label="Your voice"
                value={`${room.voteProgress.voted} of ${room.voteProgress.total} in`}
              />
              <div className="vd-cards">
                <button className="vd-card vd-card--success" onClick={act(() => onVote("approve"))}>
                  <Check size={20} />
                  <span className="vd-card__name">Approve</span>
                  <span className="vd-card__note">let this party ride</span>
                </button>
                <button className="vd-card vd-card--fail" onClick={act(() => onVote("reject"))}>
                  <X size={20} />
                  <span className="vd-card__name">Reject</span>
                  <span className="vd-card__note">turn them away</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <ActionLine label="Voice given" value={`${room.voteProgress.voted} of ${room.voteProgress.total}`} />
              <div className="vd-panel">
                <p className="vd-voice" style={{ margin: 0 }}>
                  Your vote is sealed. Nothing is revealed until every voice is in.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <ChronicleColumn room={room} />
    </div>
  );
}

/**
 * 04b · The King Returns window — an approved party can still be overturned by
 * whoever holds that plot card.
 */
export function KingReturnsScreen({
  room, pid, emblemSrc, act, onPlay, onPass,
}: Pick<TableProps, "room" | "pid" | "emblemSrc" | "act"> & {
  onPlay: () => Promise<unknown>;
  onPass: () => Promise<unknown>;
}) {
  const holders = room.plots?.kingReturnsHolders ?? [];
  const passed = room.plots?.kingReturnsPassed ?? [];
  const mine = holders.includes(pid) && !passed.includes(pid);

  return (
    <Plate
      eyebrow="The party is approved"
      title={mine ? "The King may still return" : "Holding for the King's word"}
      action={
        mine ? (
          <div className="vd-cards">
            <button className="vd-card vd-card--fail" onClick={act(onPlay)}>
              <Crown size={18} />
              <span className="vd-card__name">Overturn</span>
              <span className="vd-card__note">counts as a rejection</span>
            </button>
            <button className="vd-card vd-card--success" onClick={act(onPass)}>
              <Check size={18} />
              <span className="vd-card__name">Let them ride</span>
              <span className="vd-card__note">stand down</span>
            </button>
          </div>
        ) : (
          <div className="vd-panel" style={{ textAlign: "center" }}>
            <span className="vd-label vd-label--dim">
              {passed.length} of {holders.length} stood down
            </span>
          </div>
        )
      }
    >
      <p className="vd-voice" style={{ marginTop: 14, textAlign: "center" }}>
        {room.proposedTeam.map((id) => nameOf(room, id)).join(" · ")}
      </p>
    </Plate>
  );
}
