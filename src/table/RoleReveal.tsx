/* ============================================================================
   Your own lot, on any screen.

   The night card was the only place your role existed, so from the first
   proposal onward there was no way to check it — and at a real table people
   forget, especially which names they were shown.

   Same rule as the night card, for the same reason: press and hold, never a
   tap toggle, and nothing about the role — not the name, not the side, not the
   colour — exists in the DOM until the hold lands. The phone is in your hand in
   a room full of people who would very much like a look.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { NamePlate, RoleBrief } from "./Parts";
import type { Room } from "./types";

const HOLD_MS = 400;

/** Press-and-hold. Releasing always hides again; it can never latch open. */
export function useHold(delay = HOLD_MS) {
  const [held, setHeld] = useState(false);
  const timer = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const end = useCallback(() => {
    clear();
    setHeld(false);
  }, [clear]);

  const start = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      clear();
      // The reveal resizes what is under the finger; capture keeps every later
      // event aimed at the button so the hold cannot cancel itself.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* capture is a convenience; the window listeners below still end it */
      }
      timer.current = window.setTimeout(() => setHeld(true), delay);
    },
    [clear, delay],
  );

  // Letting go anywhere hides it, even if the finger drifted off.
  useEffect(() => {
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      clear();
    };
  }, [end, clear]);

  /**
   * A keyboard-activated button fires `click`, never `pointerdown`/`pointerup`
   * — so a keyboard-only or switch-access user could never trigger the hold
   * at all, meaning they could never see their own role. Enter/Space now
   * start and end the same hold; `e.repeat` (the browser auto-repeating a
   * held key) is ignored so the timer doesn't keep resetting.
   */
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (e.repeat) return;
      clear();
      timer.current = window.setTimeout(() => setHeld(true), delay);
    },
    [clear, delay],
  );
  const onKeyUp = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      end();
    },
    [end],
  );

  return { held, start, end, onKeyDown, onKeyUp };
}

export function RoleReveal({
  room, theme,
}: {
  room: Room;
  theme: { goodTeamName: string; evilTeamName: string };
}) {
  const { held, start, end, onKeyDown, onKeyUp } = useHold();
  const me = room.me;

  // Watchers hold nothing, so there is nothing to offer them.
  if (!me || me.isWatcher || !me.role) return null;

  const roleDef = room.theme.roles.find((r) => r.id === me.role);
  const evil = me.team === "evil";

  return (
    <>
      <button
        className={`vd-mylot ${held ? "is-holding" : ""}`}
        type="button"
        onPointerDown={start}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={end}
        onContextMenu={(e) => e.preventDefault()}
      >
        {held ? <Eye size={14} /> : <EyeOff size={14} />}
        {held ? "Let go to hide" : "Show my role"}
      </button>

      {held && (
        <div className="vd-lotcard" role="dialog" aria-live="polite">
          <div className={`vd-studded vd-role ${evil ? "vd-role--evil" : ""}`}>
            <span className="vd-stud-b" aria-hidden />
            <div className="vd-role__side">
              {evil
                ? `You are EVIL · ${theme.evilTeamName}`
                : `You are GOOD · ${theme.goodTeamName}`}
            </div>
            <div className="vd-role__name">{roleDef?.name ?? "—"}</div>
            <RoleBrief room={room} />
            <p className="vd-lore" style={{ marginTop: 14 }}>{roleDef?.desc}</p>

            <div style={{ marginTop: 14 }}>
              <span className="vd-label">
                {roleDef?.knowledgeLabel ?? "You are shown nothing."}
              </span>
              {me.known.length > 0 && (
                <div className="vd-row" style={{ marginTop: 9 }}>
                  {me.known.map((nm) => <NamePlate key={nm}>{nm}</NamePlate>)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
