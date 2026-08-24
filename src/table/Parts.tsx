/* ============================================================================
   Pieces shared by more than one phase: the left-hand quest column, the
   chronicle, and the room → CouncilSeal seat mapping.
   ========================================================================== */

import { useMemo } from "react";
import { CouncilSeal, type Seat, type SeatState } from "../CouncilSeal";
import { QuestLadder, RejectionTrack, Chronicle, type ChronicleEntry } from "../TableParts";
import { dealSigils } from "../sigils";
import { QUEST_SIZES, doubleFailQuests } from "../../convex/logic";
import { type Room, ROMAN, partySize } from "./types";

/** Quest numeral + ladder + rejection track + the oath. */
export function QuestColumn({ room }: { room: Room }) {
  const n = room.players.length;
  const sizes = QUEST_SIZES[n] ?? [];
  const doubleFail = doubleFailQuests(n);

  return (
    <div className="vd-stack">
      <div className="vd-studded vd-panel vd-panel--strong">
        <span className="vd-stud-b" aria-hidden />
        <div className="vd-label vd-label--dim">Quest</div>
        <div className="vd-numeral" style={{ fontSize: 44, marginTop: 6 }}>
          {ROMAN[room.questIndex] ?? "—"}
        </div>
        <div className="vd-label" style={{ marginTop: 8 }}>
          {partySize(room)} ride · {room.failsNeeded} fail
          {room.failsNeeded === 1 ? "" : "s"} sinks it
        </div>
      </div>

      <QuestLadder
        sizes={sizes}
        questIndex={room.questIndex}
        results={room.questResults}
        doubleFail={doubleFail}
      />

      <RejectionTrack used={room.rejectCount} max={room.maxRejects} />

      <p className="vd-voice">
        Three quests held and the realm stands. Three lost, or five parties
        turned away, and it falls.
      </p>
    </div>
  );
}

/** The ledger. Built from what the table publicly knows — never from roles. */
export function ChronicleColumn({ room }: { room: Room }) {
  const entries = useMemo<ChronicleEntry[]>(() => {
    const out: ChronicleEntry[] = [];
    room.questResults.forEach((r, i) => {
      if (!r) return;
      out.push({
        n: i + 1,
        text: `Quest ${ROMAN[i]} rode out and came back ${r === "success" ? "whole" : "broken"}.`,
        outcome: {
          label: r === "success" ? "Held" : "Failed",
          held: r === "success",
        },
      });
    });
    if (room.lastVote) {
      out.push({
        n: out.length + 1,
        text: room.lastVote.overturnedBy
          ? "The council said yes, and the King overturned it."
          : room.lastVote.approved
            ? "The council approved the party."
            : "The council turned the party away.",
        outcome: {
          label: room.lastVote.approved && !room.lastVote.overturnedBy ? "Approved" : "Rejected",
          detail: `${room.lastVote.approvers.length}–${room.lastVote.rejecters.length}`,
          held: room.lastVote.approved && !room.lastVote.overturnedBy,
        },
      });
    }
    if (out.length === 0) {
      out.push({ n: 1, text: "Nothing has happened yet. The first party has still to be named." });
    }
    return out;
  }, [room.questResults, room.lastVote]);

  return <Chronicle entries={entries} />;
}

/**
 * Map the room onto the seal. `stateFor` decides each seat's state so one
 * component serves every phase, exactly as the design intends.
 */
export function SeatRing({
  room,
  emblemSrc,
  stateFor,
  noteFor,
  onSelect,
  isDisabled,
}: {
  room: Room;
  emblemSrc: string;
  stateFor: (p: Room["players"][number]) => SeatState;
  noteFor?: (p: Room["players"][number]) => string | undefined;
  onSelect?: (playerId: string) => void;
  isDisabled?: (seat: Seat) => boolean;
}) {
  const sigils = useMemo(
    () => dealSigils(room.players.map((p) => p.playerId)),
    [room.players.map((p) => p.playerId).join(",")], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const seats: Seat[] = room.players.map((p) => ({
    playerId: p.playerId,
    name: p.name,
    sigil: sigils[p.playerId] ?? 0,
    state: stateFor(p),
    note: noteFor?.(p),
  }));

  return (
    <CouncilSeal
      seats={seats}
      emblemSrc={emblemSrc}
      onSelect={onSelect}
      isDisabled={isDisabled}
    />
  );
}

/** A parchment name plate. The design never shows a learned name as plain text. */
export function NamePlate({ children }: { children: React.ReactNode }) {
  return <span className="vd-tile vd-tile--parchment" style={{ width: "auto" }}>{children}</span>;
}
