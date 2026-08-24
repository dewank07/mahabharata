/* ============================================================================
   The unveiling — the verdict of a council, and the deeds of a quest.

   Dressed in the Council Seal language: the overlay plate, brass studs, a
   shared-rule tally, and an outcome struck in brass or red. Radius 0, flat
   fills, no shadows and no glow — the drama is all in the timeline.
   ========================================================================== */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { Check, X } from "lucide-react";

export type LastVote = {
  roundId: number;
  approved: boolean;
  approvers: string[];
  rejecters: string[];
  /** Name of the player who overturned an approved party with King Returns. */
  overturnedBy?: string | null;
};

export type LastQuest = {
  questIndex: number;
  fails: number;
  success: boolean;
  size: number;
  /** Cards forced public by "We Found You", already resolved to names. */
  revealed?: Array<{ name: string; card: "success" | "fail" }> | null;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ROMAN = ["I", "II", "III", "IV", "V"];

function seenKey(kind: string, id: string) {
  return `kurukshetra.unveil.${kind}.${id}`;
}

export function RevealCeremony({
  code,
  lastVote,
  lastQuest,
}: {
  code: string;
  lastVote: LastVote | null;
  lastQuest: LastQuest | null;
}) {
  const [mode, setMode] = useState<"vote" | "quest" | null>(null);
  const [vote, setVote] = useState<LastVote | null>(null);
  const [quest, setQuest] = useState<LastQuest | null>(null);
  const lastVoteRef = useRef<string>("");
  const lastQuestRef = useRef<string>("");

  useEffect(() => {
    if (!lastVote) return;
    const id = `${code}:v:${lastVote.roundId}:${lastVote.approvers.length}:${lastVote.rejecters.length}:${lastVote.approved ? "y" : "n"}:${lastVote.overturnedBy ?? ""}`;
    if (id === lastVoteRef.current) return;
    lastVoteRef.current = id;
    if (sessionStorage.getItem(seenKey("vote", id))) return;
    sessionStorage.setItem(seenKey("vote", id), "1");
    setVote(lastVote);
    setQuest(null);
    setMode("vote");
  }, [code, lastVote]);

  useEffect(() => {
    if (!lastQuest) return;
    const id = `${code}:q:${lastQuest.questIndex}:${lastQuest.fails}:${lastQuest.success}:${lastQuest.size}:${(lastQuest.revealed ?? []).length}`;
    if (id === lastQuestRef.current) return;
    lastQuestRef.current = id;
    if (sessionStorage.getItem(seenKey("quest", id))) return;
    sessionStorage.setItem(seenKey("quest", id), "1");
    setQuest(lastQuest);
    setVote(null);
    setMode("quest");
  }, [code, lastQuest]);

  if (!mode) return null;

  // A rejected party or a fallen quest turns the plate's rules and studs red.
  const fallen =
    mode === "vote"
      ? vote != null && (!vote.approved || vote.overturnedBy != null)
      : quest != null && !quest.success;

  return (
    <div
      className="vd-overlay vd-overlay--unveil"
      onClick={() => setMode(null)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`vd-plate vd-studded ${fallen ? "vd-plate--danger" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="vd-stud-b" aria-hidden />
        {mode === "vote" && vote && (
          <VoteUnveil vote={vote} onDone={() => setMode(null)} />
        )}
        {mode === "quest" && quest && (
          <QuestUnveil quest={quest} onDone={() => setMode(null)} />
        )}
        <button
          type="button"
          className="vd-btn vd-btn--primary vd-unveil__skip"
          onClick={() => setMode(null)}
        >
          <span>Continue</span>
        </button>
      </div>
    </div>
  );
}

function VoteUnveil({ vote, onDone }: { vote: LastVote; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const yes = vote.approvers.length;
  const no = vote.rejecters.length;
  const done = useRef(onDone);
  done.current = onDone;

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      // The system is flat and engraved: things rise and settle, they never
      // pop or spin in.
      tl.from(".vd-unveil__title", { y: 16, opacity: 0, duration: 0.35 })
        .from(
          ".vd-tally__side",
          { y: 12, opacity: 0, stagger: 0.12, duration: 0.45 },
          "-=0.1",
        )
        .from(".vd-stamp", { y: 10, opacity: 0, duration: 0.4 }, "+=0.15")
        .to({}, { duration: 1.4 })
        .add(() => done.current());
    }, root);
    return () => ctx.revert();
  }, []);

  const held = vote.approved && !vote.overturnedBy;

  return (
    <div ref={root} className="vd-unveil">
      <div className="vd-label vd-unveil__eyebrow">The vote is counted</div>
      <h2 className="vd-h1 vd-unveil__title">The council has spoken</h2>

      <div className="vd-tally">
        <div className="vd-tally__side">
          <span className="vd-label">
            <Check size={11} strokeWidth={2.5} /> Support
          </span>
          <strong className="vd-tally__n">{yes}</strong>
        </div>
        <div className="vd-tally__side vd-tally__side--no">
          <span className="vd-label">
            <X size={11} strokeWidth={2.5} /> Oppose
          </span>
          <strong className="vd-tally__n">{no}</strong>
        </div>
      </div>

      <div className={`vd-stamp ${held ? "" : "vd-stamp--fallen"}`}>
        {vote.overturnedBy
          ? "The King returns — party overturned"
          : vote.approved
            ? "Party rides"
            : "Party turned away"}
      </div>

      <p className="vd-voice vd-unveil__note">
        {vote.overturnedBy
          ? `The council said yes (${yes}–${no}), but ${vote.overturnedBy} played King Returns. It counts as a rejection.`
          : `Majority support is required. A tie is a rejection (${yes}–${no}).`}
      </p>
    </div>
  );
}

function QuestUnveil({ quest, onDone }: { quest: LastQuest; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const cards = useMemo(() => {
    const deck: Array<"success" | "fail"> = [
      ...Array(Math.max(0, quest.size - quest.fails)).fill("success"),
      ...Array(Math.max(0, quest.fails)).fill("fail"),
    ];
    return shuffle(deck);
  }, [quest.fails, quest.size]);

  const done = useRef(onDone);
  done.current = onDone;

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const inners = gsap.utils.toArray<HTMLElement>(".vd-unveil__card-inner");
      gsap.set(inners, { rotateY: 0 });
      const tl = gsap.timeline({ defaults: { ease: "power2.inOut" } });
      tl.from(".vd-unveil__title", { y: 14, opacity: 0, duration: 0.3 })
        .from(".vd-unveil__card", {
          y: 28,
          opacity: 0,
          rotate: 6,
          stagger: 0.08,
          duration: 0.4,
        })
        .to(
          inners,
          {
            rotateY: 180,
            stagger: 0.28,
            duration: 0.55,
          },
          "+=0.25",
        )
        .from(".vd-stamp", { y: 10, opacity: 0, duration: 0.4 }, "+=0.1")
        .to({}, { duration: 1.5 })
        .add(() => done.current());
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="vd-unveil">
      <div className="vd-label vd-unveil__eyebrow">
        Quest {ROMAN[quest.questIndex] ?? quest.questIndex + 1}
      </div>
      <h2 className="vd-h1 vd-unveil__title">The deeds are turned over</h2>
      <p className="vd-voice vd-unveil__note">
        Cards are anonymous. You see how many Fails were played, not who played them.
      </p>

      <div className="vd-unveil__row">
        {cards.map((kind, i) => (
          <div key={i} className="vd-unveil__card">
            <div className="vd-unveil__card-inner">
              <div className="vd-unveil__face vd-unveil__face--back" aria-hidden />
              <div className={`vd-unveil__face vd-unveil__face--front is-${kind}`}>
                {kind === "fail" ? "Fail" : "Success"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {(quest.revealed ?? []).length > 0 && (
        <p className="vd-voice vd-unveil__note">
          Called out by We Found You:{" "}
          {(quest.revealed ?? [])
            .map((r) => `${r.name} played ${r.card === "fail" ? "Fail" : "Success"}`)
            .join(" · ")}
        </p>
      )}

      <div className={`vd-stamp ${quest.success ? "" : "vd-stamp--fallen"}`}>
        {quest.success
          ? `Quest holds — ${quest.fails} fail${quest.fails === 1 ? "" : "s"}`
          : `Quest falls — ${quest.fails} fail${quest.fails === 1 ? "" : "s"}`}
      </div>
    </div>
  );
}
