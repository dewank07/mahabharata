/* ============================================================================
   03 · Propose — the reference screen.

   Left: quest plate, ladder, rejection track. Centre: clock fuse, the seal, the
   NAMED line, the primary button. Right: chronicle. Tapping a seat toggles it;
   the button enables only at exactly QUEST_SIZES[n][questIndex].
   ========================================================================== */

import { useEffect, useState } from "react";
import { Sword } from "lucide-react";
import { ClockFuse } from "../TableParts";
import { DISCUSS_MS, SELECT_MS } from "../../convex/logic";
import { QuestColumn, ChronicleColumn, SeatRing } from "./Parts";
import { ActionLine } from "./TableShell";
import { type Room, type TableProps, ROMAN, isLeader, leaderOf, partySize } from "./types";

export function ProposeScreen({
  room, pid, emblemSrc, act, onPropose,
}: Pick<TableProps, "room" | "pid" | "emblemSrc" | "act"> & {
  onPropose: (team: string[], excaliburId?: string) => Promise<unknown>;
}) {
  const leader = leaderOf(room);
  const mine = isLeader(room, pid);
  const needed = partySize(room);
  const needsSword = room.opts.excalibur === true;

  const [picked, setPicked] = useState<string[]>([]);
  const [sword, setSword] = useState<string | null>(null);

  // A new round (or a party the server already locked) clears the local pick.
  useEffect(() => {
    setPicked([]);
    setSword(null);
  }, [room.roundId, room.questIndex]);

  const swordable = picked.filter((id) => id !== pid);
  const swordOk = !needsSword || (sword !== null && swordable.includes(sword));
  const ready = picked.length === needed && swordOk;

  const toggle = (playerId: string) => {
    setPicked((q) =>
      q.includes(playerId)
        ? q.filter((x) => x !== playerId)
        : q.length < needed
          ? [...q, playerId]
          : q, // over-selection is prevented, never silently swapped
    );
  };

  return (
    <div className="vd-table vd-table-layout">
      <QuestColumn room={room} />

      <div className="vd-centre">
        <div className="vd-centre__wide">
          <ClockFuse
            endsAt={room.selectEndsAt ?? room.discussEndsAt ?? Date.now()}
            totalMs={DISCUSS_MS + SELECT_MS}
            caption={
              room.discussEndsAt && Date.now() < room.discussEndsAt
                ? "then one minute to lock"
                : "the party locks when this runs out"
            }
          />
        </div>

        <SeatRing
          room={room}
          emblemSrc={emblemSrc}
          stateFor={(p) =>
            picked.includes(p.playerId)
              ? "named"
              : p.playerId === leader?.playerId
                ? "leader"
                : "idle"
          }
          noteFor={(p) =>
            picked.includes(p.playerId)
              ? "Riding"
              : p.playerId === leader?.playerId
                ? mine ? "Seal · you" : "Seal"
                : undefined
          }
          onSelect={mine ? toggle : undefined}
          isDisabled={(s) =>
            !mine || (picked.length >= needed && s.state !== "named")
          }
        />

        <div className="vd-centre__wide vd-actionbar">
          {mine ? (
            <>
              {needsSword && picked.length === needed && (
                <div className="vd-stack vd-stack--tight" style={{ marginBottom: 14 }}>
                  <ActionLine label="Hand Excalibur to one rider" />
                  <div className="vd-grid2">
                    {swordable.map((id) => {
                      const nm = room.players.find((p) => p.playerId === id)?.name ?? id;
                      const on = sword === id;
                      return (
                        <button
                          key={id}
                          className={`vd-tile vd-tile--btn ${on ? "vd-tile--brass" : ""}`}
                          onClick={() => setSword(on ? null : id)}
                        >
                          <Sword size={13} color={on ? "var(--vd-brass)" : "var(--vd-ink-dim)"} />
                          {nm}
                          {on && <span className="vd-tile__meta">bearer</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <ActionLine
                label="Named"
                value={`${ROMAN[Math.max(0, picked.length - 1)] ?? picked.length} of ${ROMAN[needed - 1] ?? needed}`}
              />
              <button
                className="vd-btn vd-btn--primary"
                disabled={!ready}
                onClick={act(async () => {
                  await onPropose(picked, needsSword ? sword ?? undefined : undefined);
                  setPicked([]);
                  setSword(null);
                })}
              >
                <span>Put the party to the council</span>
                <span className="vd-btn__meta">{picked.length}/{needed}</span>
              </button>
            </>
          ) : (
            <>
              <ActionLine label="Waiting" value={leader?.name.toUpperCase()} />
              <div className="vd-panel">
                <p className="vd-voice" style={{ margin: 0 }}>
                  {leader?.name} holds the seal and is naming {needed} to ride.
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

/** Shared by vote/quest/lady: who is riding, as parchment plates. */
export function Riders({ room }: { room: Room }) {
  return (
    <div className="vd-stack vd-stack--tight">
      <ActionLine label="Riding" />
      {room.proposedTeam.map((id) => {
        const p = room.players.find((x) => x.playerId === id);
        const sword = room.excalibur?.holderId === id;
        const calledOut = (room.plots?.calledOutIds ?? []).includes(id);
        return (
          <div key={id} className="vd-tile vd-tile--parchment">
            {p?.name ?? id}
            {(sword || calledOut) && (
              <span className="vd-tile__meta" style={{ color: "#171410", opacity: 0.7 }}>
                {sword ? "Excalibur" : ""}{sword && calledOut ? " · " : ""}{calledOut ? "Called out" : ""}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
