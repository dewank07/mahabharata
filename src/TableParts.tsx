/* ============================================================================
   Shared pieces: the mission board, the chronicle and the overlay plate.

   `QuestLadder` and `StatusStrip` used to draw the same five facts two
   different ways and had to be kept in step by hand. `MissionCoins` is that
   one board, struck as coins per the design system — and it carries
   everything BOTH of them carried: the mission number, the party size, the
   tally a ridden mission came back with, the two-fails mark, and the line
   that explains that mark.

   `ClockFuse` (a 52px numeral, a caption and fifteen ticks) and
   `RejectionTrack` (dots under a sentence explaining them) both left when the
   gameplay screens stopped having a column to put them in: the clock is a
   readout in the bar with a hairline under it, and the rejection dots are part
   of `StatusStrip`.
   ========================================================================== */

import { useEffect, useRef } from "react";
import { useHeldQuests } from "./reveal-gate";

/* --------------------------------------------------------- mission board --- */

/**
 * The five missions, as struck coins.
 *
 * One coin carries two lines because it has to carry two facts: WHICH mission
 * it is, and what is known about it — the party size before it rides, the
 * `successes–fails` it came back with after. The coin's colour says whether it
 * held; the numbers say by how much, which is the thing the next round argues
 * about.
 *
 * `size="lg"` is the reckoning, where the board is the record rather than a
 * readout, and where the two-fails legend is worth the line it costs.
 */
export function MissionCoins({
  sizes,
  questIndex,
  results,
  doubleFail = [],
  log = [],
  size = "sm",
  legend = false,
  holdUnrevealed = false,
}: {
  sizes: number[];
  questIndex: number;
  results: (("success" | "fail") | null)[];
  doubleFail?: number[];
  log?: Array<{ questIndex: number; successes: number; fails: number }>;
  size?: "sm" | "lg";
  legend?: boolean;
  /**
   * Draw a quest as un-ridden while its unveil is still owed to this player.
   *
   * The server writes the result and the tally in one patch, so without this
   * the coin turns red and prints "0–2" the instant the last card lands —
   * behind an unveil that is still showing those cards face down. On for the
   * in-play strip; off for the reckoning, which is the record after the game
   * and has nothing left to spoil.
   */
  holdUnrevealed?: boolean;
}) {
  const heldQuests = useHeldQuests();

  return (
    <>
      <div
        className={`vd-coins ${size === "lg" ? "vd-coins--lg" : ""}`}
        role="group"
        aria-label="The five missions"
      >
        {sizes.map((n, i) => {
          // Everything this coin knows is withheld together — the colour and
          // the count come from the same write and would give each other away.
          const held = holdUnrevealed && heldQuests.has(i);
          const result = held ? null : results[i];
          const active = i === questIndex;
          const tally = held ? undefined : log.find((q) => q.questIndex === i);
          const twoFails = doubleFail.includes(i);
          return (
            <span
              key={i}
              className={[
                "vd-slot",
                active ? "is-active" : "",
                result === "fail" ? "is-fail" : "",
                result === "success" ? "is-held" : "",
              ].filter(Boolean).join(" ")}
              style={{ animationDelay: `calc(var(--stagger) * ${i})` }}
              aria-label={
                tally
                  ? `Mission ${i + 1}: ${tally.successes} succeeded, ${tally.fails} failed`
                  : `Mission ${i + 1}: ${n} people go${twoFails ? ", needs two fails" : ""}`
              }
            >
              <span className="vd-slot__n" aria-hidden>{i + 1}</span>
              <span className="vd-slot__face" aria-hidden>
                {tally ? (
                  <>
                    {tally.successes}
                    <i className="vd-slot__dash">–</i>
                    <i className={tally.fails > 0 ? "vd-slot__fails" : undefined}>{tally.fails}</i>
                  </>
                ) : (
                  n
                )}
              </span>
              {twoFails && <span className="vd-slot__dbl" aria-hidden />}
            </span>
          );
        })}
      </div>

      {/* The mark on a coin's rim means nothing on its own. */}
      {legend && doubleFail.length > 0 && (
        <p className="vd-coins__legend">
          <span className="vd-slot__dbl" aria-hidden />
          {doubleFail.length === 1
            ? `Mission ${doubleFail[0] + 1} needed two Fail cards to fail`
            : `Missions ${doubleFail.map((i) => i + 1).join(" and ")} needed two Fail cards to fail`}
        </p>
      )}
    </>
  );
}

/* ------------------------------------------------------------ chronicle --- */

export type ChronicleEntry = {
  n: number;
  text: string;
  outcome?: { label: string; detail?: string; held?: boolean };
  /** Named sides of a vote. The unveil is a moment; this is the record. */
  sides?: { for: string[]; against: string[] };
  /**
   * How a quest actually came back. The unveil shows this once and closes; the
   * table then spends the next round arguing about what the count was, so the
   * ledger keeps it.
   */
  tally?: { successes: number; fails: number; size: number; failsNeeded: number };
};

export function Chronicle({ entries }: { entries: ChronicleEntry[] }) {
  return (
    <div>
      {/* No heading of its own any more. This was a column with a title; it is
          now the second half of the ⓘ sheet, which titles it. */}
      <div>
        {entries.map((e) => (
          <div className="vd-chron__entry" key={e.n}>
            <span className="vd-chron__n">{String(e.n).padStart(2, "0")}</span>
            <div style={{ flex: 1 }}>
              <p className="vd-chron__text">{e.text}</p>
              {e.sides && (
                <dl className="vd-chron__sides">
                  <dt>Voted yes</dt>
                  <dd>{e.sides.for.length ? e.sides.for.join(", ") : "nobody"}</dd>
                  <dt>Voted no</dt>
                  <dd>{e.sides.against.length ? e.sides.against.join(", ") : "nobody"}</dd>
                </dl>
              )}
              {e.tally && (
                <div className="vd-chron__tally">
                  <span className="vd-chron__tally-part">
                    <b>{e.tally.successes}</b> succeed{e.tally.successes === 1 ? "" : "s"}
                  </span>
                  <span
                    className={`vd-chron__tally-part ${e.tally.fails > 0 ? "is-fail" : ""}`}
                  >
                    <b>{e.tally.fails}</b> fail{e.tally.fails === 1 ? "" : "s"}
                  </span>
                  <span className="vd-chron__tally-of">
                    of {e.tally.size}
                    {e.tally.failsNeeded > 1 ? ` · ${e.tally.failsNeeded} needed to fail` : ""}
                  </span>
                </div>
              )}
              {e.outcome && (
                <div className={`vd-chron__outcome ${e.outcome.held ? "vd-chron__outcome--held" : ""}`}>
                  <span>{e.outcome.label}</span>
                  {e.outcome.detail && (
                    <span style={{ font: "700 11px/1 var(--vd-ui)", color: "var(--vd-ink-dim)" }}>{e.outcome.detail}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- plate ---- */

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Plate({
  eyebrow, title, danger, children, action,
}: {
  eyebrow: string;
  title: string;
  danger?: boolean;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  /**
   * WAI-ARIA modal-dialog basics: move focus in on mount, and keep Tab from
   * leaving the dialog. Deliberately NOT adding Escape-to-dismiss here —
   * unlike `RevealCeremony` (a dismissable announcement, where Escape already
   * exists and is correct), several screens built on `Plate` — Excalibur,
   * King Returns — are a forced, non-skippable game decision. There's no
   * single action that's safe to bind Escape to across all of them.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const items = () =>
      Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => !n.hasAttribute("disabled"),
      );
    // Focus the plate itself, not its first focusable descendant. `children`
    // render before `action`, so "first focusable" is often the riskiest
    // option on screen — Excalibur's "Flip", King Returns' "Overturn" — not
    // the safe default. `el` (tabIndex={-1} below) is a neutral landing spot
    // a screen reader still announces via aria-label.
    el.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = items();
      if (focusable.length === 0) {
        // Nothing inside to cycle to — hold focus here rather than letting
        // Tab reach the board behind the overlay, which is not inert.
        e.preventDefault();
        el.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      // Mount hands focus to `el` itself, which matches neither `first` nor
      // `last` — without this branch, a Shift+Tab on the very first keypress
      // fell through to the browser's native backward walk, landing on
      // whatever precedes the overlay in the document (the topbar, the
      // shellbar) instead of staying trapped.
      if (document.activeElement === el) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="vd-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div
        ref={ref}
        tabIndex={-1}
        className={`vd-plate vd-studded ${danger ? "vd-plate--danger" : ""}`}
      >
        <span className="vd-stud-b" aria-hidden />
        <div className="vd-label" style={{ justifyContent: "center", letterSpacing: ".14em" }}>{eyebrow}</div>
        <h2 className="vd-hero" style={{ marginTop: 12, textAlign: "center" }}>{title}</h2>
        {children}
        {action && <div style={{ marginTop: 20 }}>{action}</div>}
      </div>
    </div>
  );
}
