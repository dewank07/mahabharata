/* ============================================================================
   One rule for every entrance animation in the app.

   Every animated surface here is built with `gsap.from(...)`, which works by
   hiding the element on frame one and revealing it as the timeline plays. That
   is fine while someone is watching, and a trap when nobody is:

   - `requestAnimationFrame` does not fire in a background tab, so a timeline
     that starts there freezes at frame one and its content stays invisible.
     A link opened in a background tab, or a phone put down for a second, was
     enough to leave the front page completely blank, or a quest result
     unreadable behind a Continue button.
   - `prefers-reduced-motion` was honoured in some places and not others, so
     the same request produced a static landing page and a full card-flip
     sequence on the quest reveal.

   `settleWhenUnwatched` answers the two differently, because they are not the
   same request.

   Reduced motion is a standing instruction: show the finished frame, always.
   Scrubbing a timeline forward still fires its own callbacks, so anything the
   animation was supposed to trigger on the way (a colour landing, a "done"
   flag) still happens.

   A hidden tab is not an instruction — it is an absence. This used to settle
   that case too, and the cost fell on the one timeline where the animation IS
   the information: the quest unveil, whose whole job is turning the cards over
   one at a time. Any transition to hidden completed it irreversibly, so a
   player who glanced at a notification during the two seconds of the flip came
   back to cards already face-up, for that round, permanently — while the
   players who happened to be looking saw the reveal. On a table of eight
   phones that is a different subset of people every round, which is why it
   read as intermittent.

   So a hidden tab now PAUSES and plays on return. That keeps the guarantee
   that mattered — nothing is ever stuck invisible in front of someone who is
   actually looking — without spending the ceremony on a moment nobody saw.
   Pausing also sidesteps gsap's catch-up: a playhead that never advanced has
   nothing to jump.

   Call it with the timeline, from inside `gsap.context(...)`, and return its
   result so the context tears the listener down with everything else.
   ========================================================================== */

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** `gsap` here is the global namespace gsap's own types declare — no import
 *  is needed for the type, and importing one only pulls the library into a
 *  module that never calls it. */
export function settleWhenUnwatched(tl: gsap.core.Timeline): () => void {
  if (prefersReducedMotion()) {
    tl.progress(1);
    return () => {};
  }

  // Held at frame one rather than run to the end: the content is invisible
  // while it waits, which is correct, because nobody is looking at it.
  if (document.visibilityState === "hidden") tl.pause(0);

  const onChange = () => {
    if (document.visibilityState === "hidden") {
      tl.pause();
    } else {
      // Resumes from wherever it stopped, or starts from the top if it never
      // got to run. A timeline that already finished stays finished — `play()`
      // does not rewind one, so coming back to a page cannot replay it.
      tl.play();
    }
  };

  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
