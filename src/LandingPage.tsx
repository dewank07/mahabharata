/* ============================================================================
   The front door — a static holding page while the game is still behind /play.

   The animation earns its place by saying what the product is: the mark turns
   once and its two counter-dots trade sides, which is the whole premise —
   friends become foes. Everything else rises and settles. No glow, no bounce,
   nothing that contradicts the flat engraved board it sits on.
   ========================================================================== */

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ArrowRight } from "lucide-react";
import markSrc from "./assets/mark.svg";

const WORDMARK = "DECEVIA";

export function LandingPage() {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    // Anyone who has asked for less motion gets the finished frame, not a
    // slower version of the show.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

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
        .from(".lp-cta", { y: 14, opacity: 0, duration: 0.5 }, "-=0.25")
        .from(".lp-foot", { opacity: 0, duration: 0.5 }, "-=0.2");

      // The waiting signal: one slow brass pulse on the dot, forever. A border
      // that breathes would read as a glow, which the system does not allow.
      gsap.to(".lp-cta__dot", {
        opacity: 0.25,
        duration: 1.4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }, root);
    return () => ctx.revert();
  }, []);

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
          A council of five to eighteen. Some of you are sworn to the realm, and
          some of you are lying about it. Five worlds to find out in.
        </p>

        <div className="lp-cta">
          <span className="lp-cta__dot" aria-hidden />
          Coming soon
        </div>

        <div className="lp-foot">
          {/* The way in while the front door is still shut. Delete this link
              when the game opens to everyone and /play becomes the index. */}
          <a className="vd-textbtn lp-enter" href="#/play">
            Enter the council <ArrowRight size={11} />
          </a>
          <a className="vd-textbtn" href="#/rules">
            Read the laws
          </a>
        </div>
      </div>
    </div>
  );
}
