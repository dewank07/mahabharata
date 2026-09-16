/* ============================================================================
   Your own lot, on any screen.

   The night card was the only place your role existed, so from the first
   proposal onward there was no way to check it — and at a real table people
   forget, especially which names they were shown.

   Shorter than the night card on purpose: mid-game you are checking a fact,
   not being introduced to a character, so this is the side, the name, the job
   and who you were shown — no lore paragraph.

   Same rule as the night card, for the same reason: press and hold, never a
   tap toggle, and nothing about the role — not the name, not the side, not the
   colour — exists in the DOM until the hold lands. The phone is in your hand in
   a room full of people who would very much like a look.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { CharacterCard } from "../CharacterCard";
import { characterFor, rolesInPlay, usePreloadArt } from "../characters";
import { KnownPlayers, RoleBrief } from "./Parts";
import { play } from "../sound";
import type { Room } from "./types";

const HOLD_MS = 400;

/**
 * Press-and-hold. Releasing always hides again; it can never latch open.
 *
 * Two cues, and they are why this hook plays sound at all rather than its call
 * sites: the knock on `start` is what tells you the hold has BEGUN — before
 * this there were 400ms in which a press that was registering and a press that
 * had missed the button looked and felt identical — and it is also the gesture
 * that opens the audio context, so the brass on reveal, which fires from a
 * timer and is no longer a gesture itself, has somewhere to play.
 *
 * The reveal cue is the same for both sides. See rule 1 in `sound.ts`: this
 * component keeps the role out of the DOM until the hold lands, and a cue that
 * differed by allegiance would put it back through the speaker.
 */
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
      play("tap", true);
      timer.current = window.setTimeout(() => {
        setHeld(true);
        play("reveal");
      }, delay);
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
      // Same pair as the pointer path, so the keyboard hold is not the quiet
      // one — a key press is as much a gesture as a tap.
      play("tap", true);
      timer.current = window.setTimeout(() => {
        setHeld(true);
        play("reveal");
      }, delay);
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

  /* The card is mounted only while the hold lasts, so an uncached portrait
     starts downloading at the moment it is needed and arrives after the
     finger has already lifted — the reveal shows the engraved monogram and
     the painting never appears at all. The night screen warms the cast for
     exactly this reason; anyone who joined mid-game never saw that screen,
     and this is their first hold.

     The whole in-play set, not your own portrait: a request for one file
     would put your role in the network log, which is the thing the rest of
     this component goes to lengths to keep out of the DOM. Keyed on the url
     list inside `usePreloadArt`, so it fetches once and not per phase. */
  usePreloadArt(
    rolesInPlay(room.opts as Record<string, boolean | undefined>).map(
      (id) => characterFor(room.theme, id)?.image,
    ),
  );

  // Watchers hold nothing, so there is nothing to offer them.
  if (!me || me.isWatcher || !me.role) return null;

  const roleDef = room.theme.roles.find((r) => r.id === me.role);
  const character = characterFor(room.theme, me.role);
  const evil = me.team === "evil";

  /* The same hold, offered twice.

     On a desktop the bar is where you look for your own things, and the
     control has room for its label. On a phone the bar is the furthest
     corner of the screen from a thumb, and the button there had already been
     squeezed down to a 42px eyeball — so the phone gets a handle pinned to
     the bottom edge instead, under the thumb that is already there to vote.

     Both drive one `useHold`, so there is one hold, one timer and one piece of
     state: whichever is visible at this width starts it, and letting go of
     either ends it. CSS decides which one that is — see `.vd-lothandle`. */
  const trigger = {
    type: "button" as const,
    onPointerDown: start,
    onPointerUp: end,
    onPointerCancel: end,
    onKeyDown,
    onKeyUp,
    onBlur: end,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  };

  return (
    <>
      <button {...trigger} className={`vd-mylot ${held ? "is-holding" : ""}`}>
        {held ? <Eye size={14} /> : <EyeOff size={14} />}
        <span className="vd-mylot__label">
          {held ? "Let go to hide" : "Show my role"}
        </span>
      </button>

      <button {...trigger} className={`vd-lothandle ${held ? "is-holding" : ""}`}>
        {held ? <Eye size={15} /> : <EyeOff size={15} />}
        <span>{held ? "Let go to hide" : "Hold for my role"}</span>
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
            {/* Portrait left, who-you-are right, and everything the role has to
                tell you underneath. */}
            <div className="cc-reveal">
              {character && (
                <div className="cc-reveal__card">
                  <CharacterCard
                    character={character}
                    size="md"
                    mode="static"
                    showPlate={false}
                  />
                </div>
              )}
              <div className="cc-reveal__body">
                <div className="vd-role__name">{roleDef?.name ?? "—"}</div>
                <RoleBrief room={room} />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <span className="vd-label">
                {roleDef?.knowledgeLabel ?? "You are shown nothing."}
              </span>
              {me.known.length > 0 && (
                <KnownPlayers room={room} names={me.known} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
