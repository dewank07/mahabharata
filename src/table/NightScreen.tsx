/* ============================================================================
   02 · The night — your role.

   One studded card, held close to the chest: press and hold to see it, never a
   tap toggle, because the phone is in your hand in a room full of people.
   Below it the full NIGHT_ORDER script with your own step struck in brass —
   knowing *when* you were shown something is part of the game.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Sword } from "lucide-react";
import { Studded } from "./TableShell";
import { NamePlate } from "./Parts";
import type { TableProps } from "./types";

const HOLD_MS = 600;

/** Press-and-hold. Releasing always hides again; it can never latch open. */
function useHold(delay = HOLD_MS) {
  const [held, setHeld] = useState(false);
  const timer = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const start = useCallback(() => {
    clear();
    timer.current = window.setTimeout(() => setHeld(true), delay);
  }, [clear, delay]);

  const end = useCallback(() => {
    clear();
    setHeld(false);
  }, [clear]);

  useEffect(() => () => clear(), [clear]);
  return { held, start, end };
}

export function NightScreen({
  room, pid, theme, act, onBegin,
}: Pick<TableProps, "room" | "pid" | "theme" | "act"> & {
  onBegin: () => Promise<unknown>;
}) {
  const { held, start, end } = useHold();
  const me = room.me;
  const isHost = room.hostId === pid;
  const watching = room.seating.iAmWatching;

  const roleDef = me?.role
    ? room.theme.roles.find((r) => r.id === me.role)
    : null;
  const evil = me?.team === "evil";
  const myStep = me?.nightStep ?? 0;

  // Only list steps whose role could actually be in this game.
  const steps = room.nightOrder.filter((s) => {
    if (s.step === 2) return room.opts.guinevere === true;
    if (s.step === 4) return room.opts.percival === true;
    if (s.step === 5) return room.opts.lovers === true;
    return true;
  });

  return (
    <div className="vd-table vd-table-layout">
      <div className="vd-stack">
        <div className="vd-label vd-label--dim">The night</div>
        <p className="vd-voice">
          The room goes dark and each of you is shown only what you are owed.
          Hold the card to read it; let go and it is gone.
        </p>
      </div>

      <div className="vd-centre">
        <div className="vd-centre__wide">
          {watching ? (
            <Studded className="vd-role">
              <div className="vd-role__side">Watching</div>
              <div className="vd-role__hidden">No role</div>
              <p className="vd-voice" style={{ margin: 0 }}>
                You are in the queue, not in the game. You will see the board and
                hear the room, but no allegiance is yours this round.
              </p>
            </Studded>
          ) : (
            <Studded className={`vd-role ${evil ? "vd-role--evil" : ""}`}>
              <div className="vd-role__side">
                {evil
                  ? `Sworn against · ${theme.evilTeamName}`
                  : `Sworn to · ${theme.goodTeamName}`}
              </div>

              {held ? (
                <>
                  <div className="vd-role__name">{roleDef?.name ?? "—"}</div>
                  <p className="vd-voice" style={{ margin: 0 }}>{roleDef?.desc}</p>

                  <div style={{ marginTop: 16 }}>
                    <span className="vd-label vd-label--dim">
                      {roleDef?.knowledgeLabel ?? "You are shown nothing."}
                    </span>
                    {(me?.known.length ?? 0) > 0 && (
                      <div className="vd-row" style={{ marginTop: 10 }}>
                        {me!.known.map((nm) => (
                          <NamePlate key={nm}>{nm}</NamePlate>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="vd-role__hidden">— — —</div>
                  <p className="vd-voice" style={{ margin: 0 }}>
                    Hold to read your allegiance.
                  </p>
                </>
              )}

              <button
                className={`vd-hold ${held ? "is-holding" : ""}`}
                onPointerDown={start}
                onPointerUp={end}
                onPointerLeave={end}
                onPointerCancel={end}
                onContextMenu={(e) => e.preventDefault()}
              >
                {held ? <Eye size={13} /> : <EyeOff size={13} />}
                {held ? "Release to hide" : "Hold to reveal"}
              </button>
            </Studded>
          )}
        </div>

        <div className="vd-centre__wide vd-actionbar">
          {isHost ? (
            <button className="vd-btn vd-btn--primary" onClick={act(onBegin)}>
              <span>All have read their lot — begin</span>
              <Sword size={16} />
            </button>
          ) : (
            <div className="vd-panel">
              <p className="vd-voice" style={{ margin: 0 }}>
                Study it. The host opens the first council when everyone is ready.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="vd-stack">
        <span className="vd-label">How the night went</span>
        <div>
          {steps.map((s) => {
            const mine = s.step === myStep;
            return (
              <div key={s.step} className={`vd-script__row ${mine ? "is-mine" : ""}`}>
                <span className="vd-script__n">{s.step}</span>
                <span className="vd-script__text">{s.label}</span>
                {mine && <span className="vd-script__you">you</span>}
              </div>
            );
          })}
        </div>
        {myStep === 0 && !watching && (
          <p className="vd-voice" style={{ margin: 0 }}>
            You slept through all of it. No vision is yours.
          </p>
        )}
      </div>
    </div>
  );
}
