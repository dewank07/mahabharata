/* ============================================================================
   Shared pieces: the clock fuse, the quest ladder, the rejection track, the
   chronicle, and the overlay plate. All flat — no animation, no glow.
   ========================================================================== */

import { useEffect, useState } from "react";

/* ---------------------------------------------------------------- clock --- */

/**
 * The clock is a number plus a fuse of flat ticks. It never animates: it
 * re-renders once a second and ticks go dark in whole steps, which reads as
 * urgency without motion.
 */
export function ClockFuse({
  endsAt,
  totalMs,
  ticks = 15,
  caption = "then one minute to lock",
}: { endsAt: number; totalMs: number; ticks?: number; caption?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = Math.max(0, endsAt - now);
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  const lit = Math.ceil((remaining / totalMs) * ticks);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div className="vd-clock" role="timer" aria-live="off">
          {mm}:{String(ss).padStart(2, "0")}
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="vd-label">To decide</div>
          {caption && (
            <div style={{ marginTop: 7, font: "italic 400 13px/1 var(--vd-voice)", color: "var(--vd-ink-dim)" }}>
              {caption}
            </div>
          )}
        </div>
      </div>
      <div className="vd-fuse" style={{ marginTop: 13 }} aria-hidden>
        {Array.from({ length: ticks }, (_, i) => (
          <i key={i} className={i < lit ? "is-lit" : undefined} />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- quest ladder --- */

const ROMAN = ["I", "II", "III", "IV", "V"];

export function QuestLadder({
  sizes,
  questIndex,
  results,
  doubleFail = [],
}: {
  sizes: number[];                                  // QUEST_SIZES[playerCount]
  questIndex: number;
  results: (("success" | "fail") | null)[];
  /** Quests needing two fails: Q4 at 7+, and Q3 as well above ten. */
  doubleFail?: number[];
}) {
  return (
    <div>
      <div className="vd-label vd-label--dim">The five quests</div>
      <div className="vd-seg" style={{ marginTop: 12 }}>
        {sizes.map((size, i) => {
          const result = results[i];
          const active = i === questIndex;
          return (
            <div key={i} className={active ? "is-active" : undefined} style={{ position: "relative" }}>
              <div className="vd-numeral" style={{
                fontSize: 16,
                color: active ? "#171410" : result === "fail" ? "var(--vd-red-ink)" : result ? "var(--vd-ink)" : "var(--vd-ink-muted)",
              }}>
                {ROMAN[i]}
              </div>
              <div style={{
                marginTop: 5, font: "700 9px/1 var(--vd-ui)",
                color: active ? "rgba(23,20,16,.6)" : "var(--vd-ink-dim)",
              }}>
                {size}
              </div>
              {doubleFail.includes(i) && (
                <span style={{ position: "absolute", top: 4, right: 4, width: 5, height: 5, background: "var(--vd-red)" }} />
              )}
            </div>
          );
        })}
      </div>
      {doubleFail.length > 0 && (
        <div style={{ marginTop: 9, display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 5, height: 5, background: "var(--vd-red)" }} />
          <span style={{ font: "400 12px/1.4 var(--vd-voice)", color: "var(--vd-ink-dim)" }}>
            {doubleFail.length === 1
              ? `the ${ROMAN[doubleFail[0]]} quest needs two fails`
              : `quests ${doubleFail.map((i) => ROMAN[i]).join(" and ")} need two fails`}
          </span>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------- rejection track --- */

export function RejectionTrack({ used, max = 5 }: { used: number; max?: number }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="vd-label vd-label--dim">Rejections</span>
        <span style={{ font: "600 10px/1 var(--vd-ui)", letterSpacing: ".08em", color: "var(--vd-red-ink)" }}>
          {used} of {max}
        </span>
      </div>
      <div className="vd-track" style={{ marginTop: 11 }} aria-label={`${used} of ${max} rejections used`}>
        {Array.from({ length: max }, (_, i) => (
          <i key={i} className={i < used ? "is-used" : undefined} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ chronicle --- */

export type ChronicleEntry = {
  n: number;
  text: string;
  outcome?: { label: string; detail?: string; held?: boolean };
};

export function Chronicle({ entries }: { entries: ChronicleEntry[] }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="vd-label">The chronicle</span>
        <span className="vd-rule vd-rule--brass" style={{ flex: 1 }} />
      </div>
      <div style={{ marginTop: 16 }}>
        {entries.map((e) => (
          <div className="vd-chron__entry" key={e.n}>
            <span className="vd-chron__n">{String(e.n).padStart(2, "0")}</span>
            <div style={{ flex: 1 }}>
              <p className="vd-chron__text">{e.text}</p>
              {e.outcome && (
                <div className={`vd-chron__outcome ${e.outcome.held ? "vd-chron__outcome--held" : ""}`}>
                  <span>{e.outcome.label}</span>
                  {e.outcome.detail && (
                    <span style={{ font: "600 9px/1 var(--vd-ui)", color: "var(--vd-ink-dim)" }}>{e.outcome.detail}</span>
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

export function Plate({
  eyebrow, title, danger, children, action,
}: {
  eyebrow: string;
  title: string;
  danger?: boolean;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="vd-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`vd-plate vd-studded ${danger ? "vd-plate--danger" : ""}`}>
        <span className="vd-stud-b" aria-hidden />
        <div className="vd-label" style={{ textAlign: "center", letterSpacing: ".32em" }}>{eyebrow}</div>
        <h2 className="vd-h1" style={{ marginTop: 14, textAlign: "center", fontSize: 30 }}>{title}</h2>
        {children}
        {action && <div style={{ marginTop: 20 }}>{action}</div>}
      </div>
    </div>
  );
}
