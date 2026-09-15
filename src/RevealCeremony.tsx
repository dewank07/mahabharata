/* ============================================================================
   The unveiling — the verdict of a council, and the deeds of a quest.

   Dressed in the Council Seal language: the overlay plate, brass studs, a
   shared-rule tally, and an outcome struck in brass or red. Radius 0, flat
   fills, no shadows and no glow — the drama is all in the timeline.
   ========================================================================== */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { Check, X } from "lucide-react";
import { settleWhenUnwatched } from "./motion";
import { clearHolds, holdQuest, releaseQuest } from "./reveal-gate";

export type LastVote = {
  roundId: number;
  approved: boolean;
  approvers: string[];
  rejecters: string[];
  /** The same two lists as names. Avalon's votes are public — show them. */
  approverNames: string[];
  rejecterNames: string[];
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

/**
 * A reveal already SEEN in this tab, so a reconnect does not replay it.
 *
 * Seen means dismissed, not queued — see `dismiss` below. Wrapped because
 * Safari in private mode throws on both get and set: an uncaught throw in the
 * queueing effect took the whole ceremony down, which is one of the ways
 * players ended up never seeing a vote at all.
 */
function alreadySeen(key: string): boolean {
  try {
    return sessionStorage.getItem(`decevia.unveil.${key}`) != null;
  } catch {
    return false;
  }
}

function markSeen(key: string) {
  try {
    sessionStorage.setItem(`decevia.unveil.${key}`, "1");
  } catch {
    /* storage blocked — dedupe falls back to the in-memory ref below */
  }
}

type Reveal =
  | { key: string; kind: "vote"; vote: LastVote }
  | { key: string; kind: "quest"; quest: LastQuest };

function voteKey(code: string, v: LastVote) {
  return `${code}:v:${v.roundId}:${v.approvers.length}:${v.rejecters.length}:${v.approved ? "y" : "n"}:${v.overturnedBy ?? ""}`;
}

function questKey(code: string, q: LastQuest) {
  return `${code}:q:${q.questIndex}:${q.fails}:${q.success}:${q.size}:${(q.revealed ?? []).length}`;
}

/**
 * The unveils are a QUEUE, not a slot.
 *
 * They used to be one `mode` written by two effects. Both effects run on every
 * mount, in declaration order, and React batches them — so whenever the room
 * carried a `lastVote` AND a `lastQuest` (true from the first completed quest
 * onward), the quest effect's `setVote(null)` landed on top and the vote unveil
 * was destroyed before it ever painted. Any player whose component remounted —
 * a phone dropping off wifi, a reload, a Convex reconnect blanking `room` for a
 * frame — silently lost the approve/reject screen for that round, and because
 * the key had already been written to sessionStorage it never came back. That
 * is why only some of the table saw the vote.
 *
 * Queueing fixes both halves: a reveal that arrives while another is on screen
 * waits its turn instead of overwriting it, and nothing is ever dropped.
 */
export function RevealCeremony({
  code,
  lastVote,
  lastQuest,
}: {
  code: string;
  lastVote: LastVote | null;
  lastQuest: LastQuest | null;
}) {
  const [queue, setQueue] = useState<Reveal[]>([]);
  /**
   * The outcome is red or brass, and the plate wears it — so it cannot wear it
   * from the first frame. Eight players watched the border turn red while the
   * cards were still face down, which gave the quest away every time. The
   * unveils flip this on once they have actually shown the result. Held by KEY
   * so it cannot leak from one reveal to the next one in the queue.
   */
  const [settledKey, setSettledKey] = useState<string | null>(null);
  /** Keys queued this mount. Guards the effects, which re-run on every render. */
  const queued = useRef<Set<string>>(new Set());

  /*
    `queued` stops the same reveal being added twice within one mount — both
    effects re-run on every render, because App rebuilds the vote/quest props
    into fresh objects each time. `alreadySeen` stops it coming back in a LATER
    mount. Nothing is written to storage here: a reveal is only spent once the
    player has actually dismissed it.
  */
  const push = (item: Reveal) => {
    if (queued.current.has(item.key)) return;
    queued.current.add(item.key);
    if (alreadySeen(item.key)) return;
    /* The board must not print this quest's tally before this plate has shown
       it. Held here rather than when it reaches the front of the queue: a vote
       unveil ahead of it can keep it waiting for several seconds, and the
       mission coin behind both of them would spoil the answer for the whole of
       that wait. Released in `dismiss`.

       A reveal that `alreadySeen` rejects is deliberately never held — that is
       a reconnect, the player has already been shown this result, and holding
       it would blank a mission they have every right to see. */
    if (item.kind === "quest") holdQuest(item.quest.questIndex);
    setQueue((q) => [...q, item]);
  };

  useEffect(() => {
    if (!lastVote) return;
    push({ key: voteKey(code, lastVote), kind: "vote", vote: lastVote });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, lastVote]);

  useEffect(() => {
    if (!lastQuest) return;
    push({ key: questKey(code, lastQuest), kind: "quest", quest: lastQuest });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, lastQuest]);

  const current = queue[0] ?? null;

  /*
    The dedupe key is written HERE, not when the reveal was queued.

    Marking it at enqueue meant a reveal was spent the moment it was lined up,
    before it had painted a single frame — so if the component came down in
    between (a reload, or `room` going briefly undefined on a Convex
    reconnect, both of which this file already knows happen) storage said
    "seen" for something nobody had seen, and it never came back. That is the
    same disappearing-vote symptom the queue was meant to fix, arriving by a
    different door. A reveal is now spent only when a player has pressed
    Continue on it.
  */
  const dismiss = () => {
    if (current) {
      markSeen(current.key);
      // Shown and acknowledged — the board may say it now.
      if (current.kind === "quest") releaseQuest(current.quest.questIndex);
    }
    setQueue((q) => q.slice(1));
  };

  /* Leaving the table, or a new game under the same code, drops every hold.
     Holds are keyed by quest INDEX and those restart at 0, so one left behind
     would blank mission 1 of the next game — and a component that comes down
     mid-queue would strand its holds forever. */
  useEffect(() => clearHolds, []);

  // Escape dismisses — a deliberate key press, unlike the timer that used to
  // close this on its own.
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);

  if (!current) return null;

  const settled = settledKey === current.key;
  const waiting = queue.length - 1;

  // A rejected party or a fallen quest turns the plate's rules and studs red.
  const fallen =
    current.kind === "vote"
      ? !current.vote.approved || current.vote.overturnedBy != null
      : !current.quest.success;

  return (
    <div
      className="vd-overlay vd-overlay--unveil"
      role="dialog"
      aria-modal="true"
    >
      <div className={`vd-plate vd-studded ${fallen && settled ? "vd-plate--danger" : ""}`}>
        <span className="vd-stud-b" aria-hidden />
        {current.kind === "vote" ? (
          <VoteUnveil
            key={current.key}
            vote={current.vote}
            onSettled={() => setSettledKey(current.key)}
          />
        ) : (
          <QuestUnveil
            key={current.key}
            quest={current.quest}
            onSettled={() => setSettledKey(current.key)}
          />
        )}
        {/*
          The only way out. This used to close itself off the end of the GSAP
          timeline, about a second and a half after the stamp landed — long
          enough to miss if you had looked away, and the reason the table kept
          asking what the count had been.
        */}
        <button
          type="button"
          className="vd-btn vd-btn--primary vd-unveil__skip"
          onClick={dismiss}
          autoFocus
        >
          <span>Continue{waiting > 0 ? ` · ${waiting} more to see` : ""}</span>
        </button>
      </div>
    </div>
  );
}

function VoteUnveil({
  vote, onSettled,
}: { vote: LastVote; onSettled: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const yes = vote.approvers.length;
  const no = vote.rejecters.length;
  const settled = useRef(onSettled);
  settled.current = onSettled;

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
        .add(() => settled.current())
        .from(".vd-stamp", { y: 10, opacity: 0, duration: 0.4 }, "+=0.15");
      // Timeline ends on the stamp. It does NOT close the plate — the player does.
      return settleWhenUnwatched(tl);
    }, root);
    return () => ctx.revert();
  }, []);

  const held = vote.approved && !vote.overturnedBy;

  return (
    <div ref={root} className="vd-unveil">
      <div className="vd-label vd-unveil__eyebrow">Vote result</div>
      <h2 className="vd-hero vd-unveil__title">
        {vote.overturnedBy
          ? "Team cancelled"
          : vote.approved
            ? "Team approved"
            : "Team voted down"}
      </h2>

      <div className="vd-tally">
        <div className="vd-tally__side">
          <span className="vd-label">
            <Check size={13} strokeWidth={2.5} /> Voted yes
          </span>
          <strong className="vd-tally__n">{yes}</strong>
          <ul className="vd-tally__who">
            {vote.approverNames.map((nm) => <li key={nm}>{nm}</li>)}
            {yes === 0 && <li className="is-none">nobody</li>}
          </ul>
        </div>
        <div className="vd-tally__side vd-tally__side--no">
          <span className="vd-label">
            <X size={13} strokeWidth={2.5} /> Voted no
          </span>
          <strong className="vd-tally__n">{no}</strong>
          <ul className="vd-tally__who">
            {vote.rejecterNames.map((nm) => <li key={nm}>{nm}</li>)}
            {no === 0 && <li className="is-none">nobody</li>}
          </ul>
        </div>
      </div>

      <div className={`vd-stamp ${held ? "" : "vd-stamp--fallen"}`}>
        {vote.overturnedBy
          ? "Nobody goes"
          : vote.approved
            ? "Mission goes ahead"
            : "New leader picks"}
      </div>

      <p className="vd-voice vd-unveil__note">
        {vote.overturnedBy
          ? `The table said yes ${yes}–${no}, but ${vote.overturnedBy} played a King Returns card to cancel it. That counts as the team being voted down.`
          : vote.approved
            ? `${yes} yes to ${no} no. More yes than no, so the team goes.`
            : `${yes} yes to ${no} no. A team needs more yes than no — a tie counts as no.`}
      </p>
    </div>
  );
}

function QuestUnveil({
  quest, onSettled,
}: { quest: LastQuest; onSettled: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const cards = useMemo(() => {
    const deck: Array<"success" | "fail"> = [
      ...Array(Math.max(0, quest.size - quest.fails)).fill("success"),
      ...Array(Math.max(0, quest.fails)).fill("fail"),
    ];
    return shuffle(deck);
  }, [quest.fails, quest.size]);

  const settled = useRef(onSettled);
  settled.current = onSettled;

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
        // Every card is face up by here — only now may the plate say how it went.
        .add(() => settled.current())
        .from(".vd-stamp", { y: 10, opacity: 0, duration: 0.4 }, "+=0.1");
      // Timeline ends on the stamp. It does NOT close the plate — the player does.
      return settleWhenUnwatched(tl);
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="vd-unveil">
      <div className="vd-label vd-unveil__eyebrow">
        Mission {quest.questIndex + 1} of 5
      </div>
      <h2 className="vd-hero vd-unveil__title">The cards are in</h2>
      <p className="vd-voice vd-unveil__note">
        The order is shuffled on purpose — you learn how many Fails were
        played, never who played them.
      </p>

      <div className="vd-unveil__row">
        {cards.map((kind, i) => (
          <div key={i} className="vd-unveil__card">
            <div className="vd-unveil__card-inner">
              <div className="vd-unveil__face vd-unveil__face--back" aria-hidden />
              <div className={`vd-unveil__face vd-unveil__face--front is-${kind}`}>
                {kind === "fail" ? "Fail" : "Succeed"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {(quest.revealed ?? []).length > 0 && (
        <p className="vd-voice vd-unveil__note">
          A "We Found You" card forced these into the open:{" "}
          {(quest.revealed ?? [])
            .map((r) => `${r.name} played ${r.card === "fail" ? "Fail" : "Succeed"}`)
            .join(", ")}
        </p>
      )}

      <div className={`vd-stamp ${quest.success ? "" : "vd-stamp--fallen"}`}>
        {quest.success ? "Mission succeeded" : "Mission failed"}
        {" · "}
        {quest.fails} Fail{quest.fails === 1 ? "" : "s"}
      </div>
    </div>
  );
}
