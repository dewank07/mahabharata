/* ============================================================================
   The front door. The doors are open: two ways in, and no holding state.

   The animation earns its place by saying what the product is: the mark turns
   once and its two counter-dots trade sides, which is the whole premise —
   friends become foes. Everything else rises and settles. No glow, no bounce,
   nothing that contradicts the flat engraved board it sits on.
   ========================================================================== */

import { useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import gsap from "gsap";
import { ArrowRight, BadgeCheck, Crown, LogOut, Shield, Ticket } from "lucide-react";
import { api } from "../convex/_generated/api";
import { INDIA_CARD_BACK, THEME_ART, THEMES } from "../convex/themes";
import { useAuth } from "./auth";
import markSrc from "./assets/mark.svg";
import { prefersReducedMotion, settleWhenUnwatched } from "./motion";

const WORDMARK = "DECEVIA";

/**
 * The pairs the fan deals through.
 *
 * One good face, one evil face, and a line that is only true of the two of
 * them — so the picture is not decoration: each turn of the deck states a
 * different way the game can go wrong for you. Four pairs, because a fifth
 * starts repeating the shape of the sentence.
 *
 * Names are looked up from the theme rather than written in, so renaming a role
 * cannot strand a line that mentions it.
 *
 * All eight have painted portraits in the medieval set, which is what makes the
 * cycle possible at all — the Mahabharata plates cover eight roles too, but
 * these are lit, and at fan size that is the difference between the front door
 * looking illustrated and looking printed. They are also the FREE cast: this is
 * the door, and the door shows what you get without paying.
 *
 * The ground behind them is the medieval hall for the same reason. These faces
 * were lit on the Kurukshetra relief for a while, which looked good and meant
 * nothing; the room and the cast standing in it now agree.
 */
type PairName = (roleId: string) => string;

const PAIRS: ReadonlyArray<{
  good: string;
  evil: string;
  line: (n: PairName) => string;
}> = [
  {
    good: "merlin",
    evil: "morgana",
    line: (n) => `${n("merlin")} sees the traitors. ${n("morgana")} is one, posing as him.`,
  },
  {
    good: "percival",
    evil: "mordred",
    line: (n) => `${n("percival")} is handed one clue. ${n("mordred")} is the traitor ${n("merlin")} cannot see.`,
  },
  {
    good: "servant",
    evil: "assassin",
    /* Articles are safe in these lines only because the fan is pinned to the
       medieval world, whose names are all bare nouns ("Assassin", "Loyal
       Knight"). Point this at a world with names like "Ashwatthama" and "the"
       has to go. */
    line: (n) =>
      `A ${n("servant")} is told nothing at all. The last word belongs to the ${n("assassin")}.`,
  },
  {
    good: "guinevere",
    evil: "oberon",
    line: (n) => `${n("guinevere")} knows who can change sides. ${n("oberon")} answers to nobody.`,
  },
];

/**
 * The back in the middle is the Indian deck's, borrowed, because it is the only
 * drawn card back in the app — the medieval deck has none, and the night screen
 * gives it a hatched plate instead. It is tinted into the brass band at the CSS
 * rule for `.lp-card--c`, so it reads as a card rather than as a second world.
 * If a medieval back is ever drawn, this is the one line that changes.
 */
const CARD_BACK = INDIA_CARD_BACK;

/** How long a pair is held, and how long the tuck behind the back takes. */
const HOLD_MS = 4200;
const TUCK_MS = 340;

export function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const viewer = useQuery(api.billing.viewer, {});
  const config = useQuery(api.billing.paymentConfig, {});
  const { signOut } = useAuth();

  // `undefined` is "still asking". Showing Sign up to someone who is already
  // signed in and then swapping it out is worse than a beat of one button.
  const known = viewer !== undefined;
  const signedIn = viewer?.signedIn === true;

  /**
   * The hero never waits on the network. It plays the moment the page mounts,
   * and whatever depends on knowing who you are — the Sign up button, or the
   * account panel that replaces it — arrives afterwards, on its own.
   *
   * `heroDone` is what keeps that honest. `gsap.from()` only hides what exists
   * when the timeline is built, so an element that mounts later is outside the
   * sequence entirely: left alone it appeared instantly and unanimated, ahead
   * of the wordmark it should follow. So the late half is not rendered at all
   * until the hero has finished AND the answer is in — it then mounts exactly
   * when it is due, and gets its own entrance.
   */
  const [heroDone, setHeroDone] = useState(false);

  useLayoutEffect(() => {
    // Anyone who has asked for less motion gets the finished frame, not a
    // slower version of the show.
    if (prefersReducedMotion()) {
      setHeroDone(true);
      return;
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.from(".lp-mark", { scale: 0.7, opacity: 0, duration: 0.7 })
        // Half a turn: the light side becomes the dark one.
        .from(".lp-mark", { rotate: -180, duration: 1.1, ease: "power2.inOut" }, "<")
        .from(
          ".lp-letter",
          { y: 22, opacity: 0, stagger: 0.055, duration: 0.5 },
          "-=0.45",
        )
        // The promise arrives by spreading apart, not by fading.
        .from(
          ".lp-promise",
          { letterSpacing: "0em", opacity: 0, duration: 0.7 },
          "-=0.15",
        )
        /* The fan is DEALT. Each card starts square, stacked and low, and
           takes its own angle in turn — which is the one motion on this page
           that is a thing the game does rather than an entrance effect.
           `rotate: 0` is the from-value, so the timeline animates towards the
           angles the stylesheet already gives them and the layout stays in
           CSS. */
        .from(
          ".lp-card",
          {
            y: 26,
            rotate: 0,
            marginLeft: -86,
            opacity: 0,
            stagger: 0.09,
            duration: 0.52,
            ease: "power3.out",
            /* Hand the cards back to the stylesheet when the deal lands.
               `from()` leaves the inline transform it was writing, and an
               inline transform beats a class — so without this the hover
               spread below would be silently overridden on exactly the three
               elements it targets. */
            clearProps: "transform,marginLeft,opacity",
          },
          "-=0.3",
        )
        /* Same reason as the cards above: the caption crossfades on every
           shuffle via a class, and the inline opacity `from()` leaves behind
           would outrank it. */
        .from(
          ".lp-fan__cap",
          { opacity: 0, duration: 0.4, clearProps: "opacity" },
          "-=0.2",
        )
        .from(".lp-line", { scaleX: 0, duration: 0.6 }, "-=0.4")
        .from(".lp-lede", { y: 12, opacity: 0, duration: 0.5 }, "-=0.3")
        .from(".lp-acts", { y: 14, opacity: 0, duration: 0.5 }, "-=0.2")
        .from(".lp-foot", { opacity: 0, duration: 0.5 }, "-=0.2")
        .add(() => setHeroDone(true));

      /* The front page is the one surface where freezing mid-entrance is
         fatal: `gsap.from` starts every element at opacity 0, so a visitor who
         opens the link in a BACKGROUND tab — where rAF never fires — came back
         to a completely blank page, with `heroDone` never set and therefore no
         account panel or sign-up either. */
      return settleWhenUnwatched(tl);
    }, root);
    return () => ctx.revert();
  }, []);

  /**
   * Depth, from the pointer.
   *
   * The relief and the fan sit on the same flat page, and a still picture of a
   * wall is a still picture of a wall. Moving them by a few pixels in OPPOSITE
   * directions is the whole illusion: the carving behaves like something a long
   * way behind the cards, and the cards like objects held in front of it. Six
   * pixels is enough — more and it stops reading as parallax and starts reading
   * as the page sliding around.
   *
   * Two custom properties on the board, and CSS does the rest. Writing a
   * variable is one style recalculation; animating the two layers from here
   * would be two GSAP tweens per frame for something the compositor can do on
   * its own. Coalesced into a rAF so a 1000Hz mouse cannot schedule more work
   * than there are frames to do it in.
   *
   * Pointer only, and fine pointers only. There is no hover on a phone, a
   * device-orientation version would ask for a permission prompt on the front
   * door, and anyone who has asked for less motion gets a still page.
   */
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const el = root.current;
    if (!el) return;

    let frame = 0;
    let x = 0;
    let y = 0;

    const paint = () => {
      frame = 0;
      el.style.setProperty("--lp-px", x.toFixed(3));
      el.style.setProperty("--lp-py", y.toFixed(3));
    };

    const onMove = (e: PointerEvent) => {
      // -1 … 1 from the middle of the window, so the rest is a multiplication.
      x = (e.clientX / window.innerWidth) * 2 - 1;
      y = (e.clientY / window.innerHeight) * 2 - 1;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    // Leaving the window returns everything to centre rather than freezing it
    // wherever the pointer happened to go out.
    const onLeave = () => {
      x = 0;
      y = 0;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  /** The late arrival, eased in rather than snapped in. */
  useLayoutEffect(() => {
    if (!heroDone || !known) return;
    if (prefersReducedMotion() || document.visibilityState === "hidden") return;
    const ctx = gsap.context(() => {
      gsap.from(".lp-late", {
        y: 12, opacity: 0, duration: 0.45, ease: "power3.out",
      });
    }, root);
    return () => ctx.revert();
  }, [heroDone, known, signedIn]);

  return (
    <div className="vd-board lp" ref={root}>
      <div className="vd-content lp__inner">
        <img className="lp-mark" src={markSrc} alt="" width={64} height={64} />

        <h1 className="lp-wordmark" aria-label={WORDMARK}>
          {WORDMARK.split("").map((ch, i) => (
            <span className="lp-letter" key={i} aria-hidden>
              {ch}
            </span>
          ))}
        </h1>

        <p className="lp-promise">Where friends become foes</p>

        <CardFan />

        <hr className="lp-line" />

        {/* Two sentences, where there were five plus a numbered list.

            A front door has one job — say what this is and open. The long
            lede, the three how-to steps and the cast strip below them were all
            true and all better told elsewhere: the steps are the first screen
            of /learn, the cast is /learn#cast, and both are one tap from the
            footer. What has to be here is the shape of the thing (a party
            game, in person, on phones), the count, and the door. */}
        <p className="lp-lede">
          A hidden-roles party game for <strong>5 to 18 people</strong> in the
          same room, played on your phones. Most of you are good — a few are
          secretly not.
        </p>

        {/* Two doors, and they are the two things a visitor can actually be:
            the person setting the game up, or the person who was sent a code.
            The old page offered only "Join the council" — which, with no code
            to type, was a dead end for anyone arriving on their own. */}
        <div className="lp-acts">
          <a className="lp-act lp-act--primary" href="/play?tab=create">
            Start a new game <ArrowRight size={16} />
          </a>
          <a className="lp-act" href="/play?tab=join">
            <Ticket size={15} /> I have a code
          </a>
        </div>

        {heroDone && known && !signedIn && (
          <p className="lp-note lp-late">
            No account needed to play. <a href="/signin">Create one</a> only if
            you want the extra roles and settings.
          </p>
        )}

        {heroDone && known && signedIn && viewer && (
          <AccountCard viewer={viewer} config={config} onSignOut={signOut} />
        )}

        {/* The six-card cast strip stood here. The fan at the top of the page
            now shows the same art at ten times the size and says what the two
            faces ARE, which is the job the strip was doing badly — and the
            whole cast, with what each one does, is one tap away below. */}
        <div className="lp-foot">
          <a className="vd-textbtn" href="/learn">
            New here? See how it plays
          </a>
          <a className="vd-textbtn" href="/rules">
            Full rules
          </a>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- fan -- */

/**
 * Three cards over the council chamber.
 *
 * Decorative, and marked so: the pictures repeat nothing a screen reader
 * needs, the cast strip below is the accessible statement that the game has
 * characters, and `/learn` is the real answer. What does stay in the
 * accessibility tree is the caption, because "which world is this?" is a
 * genuine question about the picture and one this page answers nowhere else.
 *
 * `loading="eager"` against React's default: these are above the fold on every
 * screen size, and lazily-loaded hero art is a fan that assembles itself while
 * you watch. `decoding="async"` keeps them off the main thread anyway.
 */
/**
 * Three cards over the carved relief, and the two faces keep changing.
 *
 * The shuffle is the product demonstrating itself: the back never moves, the
 * two faces tuck in behind it and come back out as somebody else. That is what
 * a deal looks like, and it says the thing the page is trying to say — you do
 * not know which of these you are about to be handed — better than any
 * sentence under it does.
 *
 * Three rules the cycle obeys:
 *
 *   - It stops when you look at it. Hovering the deck holds the pair AND
 *     spreads the fan, so the moment you try to read a face, it waits. That is
 *     the pause mechanism WCAG asks of anything that auto-updates forever, and
 *     it happens to be the obvious interaction anyway.
 *   - It stops when nobody is watching. A hidden tab schedules nothing.
 *   - It never starts for anyone who asked for less motion; they get the first
 *     pair, held.
 *
 * The swap itself happens while both faces are hidden behind the back, which
 * is what makes it read as a shuffle rather than as two images being replaced.
 *
 * Decorative, and marked so: the pictures repeat nothing a screen reader
 * needs. The caption below is real text and changes with the pair — but it is
 * deliberately not a live region, because a front page that interrupts itself
 * every four seconds to read a new sentence is hostile.
 */
function CardFan() {
  const world = THEMES.medieval;
  const nameOf = (roleId: string) =>
    world.roles.find((r) => r.id === roleId)?.name ?? "";

  const [at, setAt] = useState(0);
  const [tucked, setTucked] = useState(false);
  const [paused, setPaused] = useState(false);

  const pair = PAIRS[at];
  const next = PAIRS[(at + 1) % PAIRS.length];

  /* Every shuffle schedules a swap 340ms later, and those timeouts outlive the
     effect that made them — pausing must not cancel one that is already in the
     air, or the two faces snap back out from behind the back halfway through.
     So they are collected here and cleared only on unmount. */
  const swaps = useRef<number[]>([]);
  useLayoutEffect(
    () => () => {
      for (const t of swaps.current) window.clearTimeout(t);
    },
    [],
  );

  useLayoutEffect(() => {
    if (prefersReducedMotion() || paused) return;

    /* Two steps, because the cards have to be BEHIND the back before the `src`
       changes — swap them in full view and it reads as a glitch rather than as
       a deal. `TUCK_MS` is the same number the stylesheet transitions over. */
    const id = window.setInterval(() => {
      // A tab nobody is looking at gets no shuffles and no decoded images.
      if (document.hidden) return;
      setTucked(true);
      swaps.current.push(
        window.setTimeout(() => {
          setAt((i) => (i + 1) % PAIRS.length);
          setTucked(false);
        }, TUCK_MS),
      );
    }, HOLD_MS);

    // Only the interval stops here. Pausing ends the CYCLE, never the shuffle
    // that is mid-air — that one lands, and then the deck holds.
    return () => window.clearInterval(id);
  }, [paused]);

  /* Warm the pair after this one while the current one is still on screen. The
     swap happens behind the back, so a portrait that has not arrived yet would
     fan back out as an empty card — four seconds is a generous head start. */
  useLayoutEffect(() => {
    for (const id of [next.good, next.evil]) {
      const img = new Image();
      img.decoding = "async";
      img.src = THEME_ART.medieval[id];
    }
  }, [next.good, next.evil]);

  const cards = [
    { key: "l", src: THEME_ART.medieval[pair.good] },
    { key: "c", src: CARD_BACK },
    { key: "r", src: THEME_ART.medieval[pair.evil] },
  ];

  return (
    <div className="lp-fan">
      <div
        className={`lp-fan__deck ${tucked ? "is-tucked" : ""}`}
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
      >
        <div className="lp-fan__stage" aria-hidden>
          {cards.map(({ key, src }) => (
            <div className={`lp-card lp-card--${key}`} key={key}>
              {/* Keyed on the URL so React swaps the element rather than
                  mutating `src` on a live one — a mutated `src` paints the old
                  picture until the new one decodes, which during a tuck means
                  the card fans back out still showing the face it just left. */}
              <img
                key={src}
                className="lp-card__art"
                src={src}
                alt=""
                width={362}
                height={483}
                loading="eager"
                decoding="async"
              />
            </div>
          ))}
        </div>
      </div>

      <p className={`lp-fan__cap ${tucked ? "is-tucked" : ""}`}>
        <span className="lp-fan__world">{pair.line(nameOf)}</span>
        <span className="lp-fan__script">
          The {world.name} setting — free to play.
        </span>
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- account -- */

/** A date a person would say out loud, not an ISO string. */
function onDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
}

/**
 * What this account is, and what it is worth — the question a signed-in
 * visitor actually has on the front page, in place of a Sign up button they
 * have already used.
 *
 * Every line is read from the server's own answer (`billing.viewer` and
 * `paymentConfig`) rather than restated here, so it cannot promise something
 * the entitlement code disagrees with.
 */
function AccountCard({
  viewer, config, onSignOut,
}: {
  viewer: {
    email: string | null; name: string | null; premium: boolean;
    seats: number; expiresAt: number | null; ownerEmail: string | null;
    iOwnPlan: boolean; isAdmin: boolean;
  };
  config: { premiumOptLabels?: Record<string, string> } | null | undefined;
  onSignOut: () => Promise<void>;
}) {
  const paidRoles = Object.values(config?.premiumOptLabels ?? {});

  return (
    <section className="lp-account lp-late">
      <header className="lp-account__head">
        <span className="lp-account__who">{viewer.name ?? viewer.email}</span>
        {viewer.premium ? (
          <span className="vd-pill vd-pill--brass">
            <BadgeCheck size={13} /> Paid plan
          </span>
        ) : (
          <span className="vd-pill">Free plan</span>
        )}
      </header>

      <dl className="lp-account__rows">
        <dt>Plan</dt>
        <dd>
          {viewer.premium ? (
            <>
              Premium, covering {viewer.seats}{" "}
              {viewer.seats === 1 ? "person" : "people"}
              {viewer.expiresAt ? <> · until {onDate(viewer.expiresAt)}</> : null}
              {!viewer.iOwnPlan && viewer.ownerEmail ? (
                <div className="lp-account__note">
                  A seat on {viewer.ownerEmail}'s plan.
                </div>
              ) : null}
            </>
          ) : (
            "Free — everything you need for a normal game"
          )}
        </dd>

        <dt>Players</dt>
        <dd>
          5 to 18 people
          <div className="lp-account__note">
            Free and paid games both seat up to 18.
          </div>
        </dd>

        <dt>Settings</dt>
        <dd>
          {viewer.premium
            ? "All five — Mahabharata, Medieval, Maratha, Greek, Egyptian"
            : "Medieval Kingdom"}
          <div className="lp-account__note">
            A setting only renames the characters. The rules never change.
          </div>
        </dd>

        <dt>Extra roles</dt>
        <dd>
          {viewer.premium ? (
            paidRoles.length > 0
              ? `Everything, including ${paidRoles.join(", ")}`
              : "Everything"
          ) : (
            <>
              Merlin, the Assassin, Percival, Morgana, and the plain
              good/evil roles
              <div className="lp-account__note">
                Paid adds Mordred, Oberon, Guinevere, the lovers, the
                Lancelots, the Lady of the Lake, Excalibur and plot cards.
              </div>
            </>
          )}
        </dd>
      </dl>

      <footer className="lp-account__foot">
        <a className="vd-pill" href="/upgrade">
          <Crown size={13} /> {viewer.premium ? "Manage plan" : "See what paid adds"}
        </a>
        {viewer.isAdmin && (
          <a className="vd-pill" href="/admin">
            <Shield size={13} /> Admin
          </a>
        )}
        <button className="vd-textbtn" onClick={() => void onSignOut()}>
          <LogOut size={13} /> Sign out
        </button>
      </footer>
    </section>
  );
}
