/* ============================================================================
   The first-time explainer.

   A new player's first thirty seconds used to be: a name, a code, and then a
   lobby full of setup they have no basis to judge. /learn and /rules both
   exist, but nothing ever suggested them at the one moment someone is sitting
   still with nothing to press — waiting for the host to start.

   So it fires there, once, and it is four screens long. Four because that is
   how many sentences the game actually needs before you can take a turn: who
   you are, how it is won, what a round is, and where the evidence comes from.
   Everything past that — the optional roles, the add-ons, the endings — is a
   thing to look up once you have met it, which is what /learn is for and why
   the last screen hands you over to it rather than trying to be it.

   Same rule as `RevealCeremony`: it is marked seen when a player DISMISSES it,
   never when it is merely shown. A modal that closed itself out of existence
   because a tab reloaded while it was open would be a tutorial nobody ever
   read, and there is no second first game.
   ========================================================================== */

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, X } from "lucide-react";

const SEEN_KEY = "decevia.tutorial.seen";

/**
 * Wrapped like every other storage touch in this app: Safari in private mode
 * throws on both get and set, and an uncaught throw here would take the lobby
 * down with it. A player whose storage is blocked sees the explainer each time
 * rather than never, which is the right way round to fail.
 */
export function hasSeenTutorial(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) != null;
  } catch {
    return false;
  }
}

export function markTutorialSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* storage blocked — it will offer itself again, which is survivable */
  }
}

/* `localStorage`, not `sessionStorage`. The player id and the room code are
   per-tab on purpose — two tabs are two warriors — but "I have been told how
   this game works" is a fact about the PERSON, and it has to outlive the tab
   that taught them or the second game teaches them again. */

type Slide = { title: string; body: string };

const SLIDES: Slide[] = [
  {
    title: "Most of you are good",
    body:
      "A few players are secretly working against the group. Those few know " +
      "each other from the start. Everybody else knows nothing at all.",
  },
  {
    title: "Five missions decide it",
    body:
      "Three missions succeed and the good side wins. Three fail and the " +
      "other side wins. That is the whole scoreboard.",
  },
  {
    title: "Every round: pick, vote, go",
    body:
      "One player picks who goes on the mission. Everyone votes the team up " +
      "or down. Only the people on the mission decide whether it succeeds.",
  },
  {
    title: "Talking is the game",
    body:
      "A failed mission proves somebody on it was lying. That is the only " +
      "hard evidence you ever get — the rest is what people say, and who " +
      "they tried to send.",
  },
];

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const returnTo = useRef<Element | null>(null);
  const last = i === SLIDES.length - 1;

  /* Dismissable, so Escape closes it — the same call `GameInfo` makes, and the
     opposite of `Plate`, which fronts decisions the game is actually waiting
     on. Nothing here is waiting on anything. */
  useEffect(() => {
    returnTo.current = document.activeElement;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      (returnTo.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  const slide = SLIDES[i];

  return (
    <div className="vd-overlay vd-overlay--tut" onClick={onClose}>
      <div
        ref={panel}
        tabIndex={-1}
        className="vd-plate vd-studded vd-tut"
        role="dialog"
        aria-modal="true"
        aria-label="How to play"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="vd-stud-b" aria-hidden />

        <header className="vd-tut__head">
          <span className="vd-label">How to play</span>
          <button className="vd-sheet__close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        {/* `aria-live` so a screen reader hears each new slide: the heading and
            the body are swapped in place rather than navigated to. */}
        <div className="vd-tut__body" aria-live="polite">
          <h2 className="vd-tut__title">{slide.title}</h2>
          <p className="vd-voice vd-tut__text">{slide.body}</p>
        </div>

        {/* Plain buttons, not a tablist: there are no tab panels here — the
            body is one live region that swaps. `aria-current` is what a step
            marker means, and it is what a screen reader reads as one. */}
        <div className="vd-tut__dots" role="group" aria-label="Steps">
          {SLIDES.map((s, n) => (
            <button
              key={s.title}
              className={`vd-tut__dot ${n === i ? "is-on" : ""}`}
              aria-current={n === i ? "step" : undefined}
              aria-label={`Step ${n + 1} of ${SLIDES.length}: ${s.title}`}
              onClick={() => setI(n)}
            >
              <i aria-hidden />
            </button>
          ))}
        </div>

        <div className="vd-tut__acts">
          {/* Back is a way out of a misfire, so it holds its place rather than
              appearing and shunting the primary button sideways mid-tap. */}
          <button
            className="vd-textbtn"
            onClick={() => setI((n) => n - 1)}
            disabled={i === 0}
          >
            <ArrowLeft size={14} /> Back
          </button>

          {last ? (
            <button className="vd-btn vd-btn--primary vd-tut__go" onClick={onClose}>
              <span>Got it</span>
            </button>
          ) : (
            <button
              className="vd-btn vd-btn--primary vd-tut__go"
              onClick={() => setI((n) => n + 1)}
            >
              <span>Next</span>
              <ArrowRight size={15} />
            </button>
          )}
        </div>

        {/* Offered from the start, not held back until the end: someone who
            wants the long version should not have to tap through the short
            one to be told it exists. */}
        <a className="vd-textbtn vd-tut__more" href="/learn" onClick={onClose}>
          <BookOpen size={13} /> Watch a round played out
        </a>
      </div>
    </div>
  );
}
