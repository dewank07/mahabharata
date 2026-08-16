import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { Check, X } from "lucide-react";

export type LastVote = {
  roundId: number;
  approved: boolean;
  approvers: string[];
  rejecters: string[];
};

export type LastQuest = {
  questIndex: number;
  fails: number;
  success: boolean;
  size: number;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
    const id = `${code}:v:${lastVote.roundId}:${lastVote.approvers.length}:${lastVote.rejecters.length}`;
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
    const id = `${code}:q:${lastQuest.questIndex}:${lastQuest.fails}:${lastQuest.success}:${lastQuest.size}`;
    if (id === lastQuestRef.current) return;
    lastQuestRef.current = id;
    if (sessionStorage.getItem(seenKey("quest", id))) return;
    sessionStorage.setItem(seenKey("quest", id), "1");
    setQuest(lastQuest);
    setVote(null);
    setMode("quest");
  }, [code, lastQuest]);

  if (!mode) return null;

  return (
    <div
      className="ceremony"
      onClick={() => setMode(null)}
      role="dialog"
      aria-modal="true"
    >
      <div className="ceremony__panel" onClick={(e) => e.stopPropagation()}>
        {mode === "vote" && vote && (
          <VoteUnveil vote={vote} onDone={() => setMode(null)} />
        )}
        {mode === "quest" && quest && (
          <QuestUnveil quest={quest} onDone={() => setMode(null)} />
        )}
        <button type="button" className="ceremony__skip" onClick={() => setMode(null)}>
          Continue
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
      tl.from(".ceremony__title", { y: 16, opacity: 0, duration: 0.35 })
        .from(
          ".ceremony-count",
          { scale: 0.6, opacity: 0, stagger: 0.12, duration: 0.45 },
          "-=0.1",
        )
        .from(
          ".ceremony-stamp",
          { scale: 1.6, opacity: 0, rotate: -8, duration: 0.45 },
          "+=0.15",
        )
        .to({}, { duration: 1.4 })
        .add(() => done.current());
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="ceremony__body">
      <h2 className="ceremony__title">The council has spoken</h2>
      <div className="ceremony-counts">
        <div className="ceremony-count ceremony-count--yes">
          <Check size={22} />
          <strong>{yes}</strong>
          <span>Support</span>
        </div>
        <div className="ceremony-count ceremony-count--no">
          <X size={22} />
          <strong>{no}</strong>
          <span>Oppose</span>
        </div>
      </div>
      <div className={`ceremony-stamp ${vote.approved ? "is-yes" : "is-no"}`}>
        {vote.approved ? "Party rides" : "Party turned away"}
      </div>
      <p className="ceremony__hint">
        Majority support is required. A tie is a rejection ({yes}–{no}).
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
      const inners = gsap.utils.toArray<HTMLElement>(".unveil-card__inner");
      gsap.set(inners, { rotateY: 0 });
      const tl = gsap.timeline({ defaults: { ease: "power2.inOut" } });
      tl.from(".ceremony__title", { y: 14, opacity: 0, duration: 0.3 })
        .from(".unveil-card", {
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
        .from(".ceremony-stamp", { scale: 1.5, opacity: 0, duration: 0.4 }, "+=0.1")
        .to({}, { duration: 1.5 })
        .add(() => done.current());
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="ceremony__body">
      <h2 className="ceremony__title">Quest {quest.questIndex + 1} — the deeds</h2>
      <p className="ceremony__hint">
        Cards are anonymous. You see how many Fails were played, not who played them.
      </p>
      <div className="unveil-row">
        {cards.map((kind, i) => (
          <div key={i} className="unveil-card">
            <div className="unveil-card__inner">
              <div className="unveil-card__face unveil-card__face--back">?</div>
              <div
                className={`unveil-card__face unveil-card__face--front is-${kind}`}
              >
                {kind === "fail" ? "Fail" : "Success"}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className={`ceremony-stamp ${quest.success ? "is-yes" : "is-no"}`}>
        {quest.success
          ? `Quest holds — ${quest.fails} fail${quest.fails === 1 ? "" : "s"}`
          : `Quest falls — ${quest.fails} fail${quest.fails === 1 ? "" : "s"}`}
      </div>
    </div>
  );
}
