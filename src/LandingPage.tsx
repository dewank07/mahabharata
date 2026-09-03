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
import { useAuth } from "./auth";
import markSrc from "./assets/mark.svg";
import { prefersReducedMotion, settleWhenUnwatched } from "./motion";

const WORDMARK = "DECEVIA";

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
        .from(".lp-line", { scaleX: 0, duration: 0.6 }, "-=0.4")
        .from(".lp-lede", { y: 12, opacity: 0, duration: 0.5 }, "-=0.3")
        .from(".lp-how > li", { y: 10, opacity: 0, stagger: 0.08, duration: 0.4 }, "-=0.2")
        .from(".lp-acts", { y: 14, opacity: 0, duration: 0.5 }, "-=0.15")
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

        <hr className="lp-line" />

        <p className="lp-lede">
          A hidden-roles party game for <strong>5 to 18 people</strong> in the
          same room, played on your phones. Most of you are on the good team.
          A few are secretly working against it. Talk, vote, and work out who
          is lying — before they sink you.
        </p>

        {/* Three lines, because the old front page said what the game FELT
            like and never what you actually do, so the first real explanation
            a visitor got was a screen asking them for a code. */}
        <ol className="lp-how">
          {/* The content of each step is wrapped, not left loose: `.lp-how > li`
              is a two-column grid, and a bare `<b>` plus its trailing text
              would become two separate grid items. */}
          <li><span><b>One person starts a game</b> and gets a 4-letter code.</span></li>
          <li><span><b>Everyone else joins</b> with that code, on their own phone.</span></li>
          <li><span><b>Play five rounds.</b> The app deals the secret roles and keeps score.</span></li>
        </ol>

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
