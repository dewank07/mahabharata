/* ============================================================================
   03 · Propose — the reference screen.

   One column: where the game is, the seal, the button. The seal comes FIRST
   here and only here, because on this phase it is not decoration — it is the
   control you tap to build the team.

   Gone from this screen, and why:
     the 52px clock + 15-tick fuse + caption   → a readout in the bar
     the quest column and the chronicle column → the strip, and the ⓘ sheet
     "Chosen — 1 of 3" and the button's 1/3    → the button already says it
     "Tap names on the circle above…"          → the banner already says it
     the Excalibur explanation                 → /rules
     a four-line paragraph for non-leaders     → they have nothing to press
   ========================================================================== */

import { useEffect, useState } from "react";
import { Eye, Sword } from "lucide-react";
import { SeatRing } from "./Parts";
import { StatusStrip } from "./StatusStrip";
import { ActionLine } from "./TableShell";
import {
  type Room, type TableProps, isLeader, leaderOf, partySize,
} from "./types";

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
    <div className="vd-play">
      <StatusStrip room={room} />

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
            ? "On the team"
            : p.playerId === leader?.playerId
              ? mine ? "Leader · you" : "Leader"
              : undefined
        }
        onSelect={mine ? toggle : undefined}
        isDisabled={(s) =>
          !mine || (picked.length >= needed && s.state !== "named")
        }
      />

      {/* Nothing at all for everyone else: the bar says who is choosing, and
          there is no button for them to find at the end of a scroll. */}
      {mine && (
        <div className="vd-actionbar">
          {needsSword && picked.length === needed && (
            <div className="vd-stack vd-stack--tight" style={{ marginBottom: 12 }}>
              <ActionLine label="Who carries Excalibur?" />
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
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            className="vd-btn vd-btn--primary"
            disabled={!ready}
            onClick={act(async () => {
              await onPropose(picked, needsSword ? sword ?? undefined : undefined);
              setPicked([]);
              setSword(null);
            })}
          >
            <span>
              {picked.length < needed
                ? `Pick ${needed - picked.length} more ${needed - picked.length === 1 ? "person" : "people"}`
                : !swordOk
                  ? "Choose who carries Excalibur"
                  : "Send this team to a vote"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Who is riding, on one line.
 *
 * This was a label plus one full-width parchment plate per rider, which on an
 * eight-person mission was most of a phone screen above the buttons. Excalibur
 * and a revealed card are icons rather than the words "Has Excalibur" and
 * "Card revealed" — the two things this row has to answer are who is going and
 * whether anything unusual is attached to them.
 */
export function Riders({ room }: { room: Room }) {
  return (
    <div className="vd-riders">
      <span className="vd-label">On this mission</span>
      <span className="vd-riders__list">
        {room.proposedTeam.map((id) => {
          const p = room.players.find((x) => x.playerId === id);
          const sword = room.excalibur?.holderId === id;
          const calledOut = (room.plots?.calledOutIds ?? []).includes(id);
          return (
            <span key={id} className="vd-rider">
              {p?.name ?? id}
              {sword && <Sword size={11} aria-label="Carries Excalibur" />}
              {calledOut && <Eye size={11} aria-label="Card was revealed" />}
            </span>
          );
        })}
      </span>
    </div>
  );
}
