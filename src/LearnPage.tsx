/* ============================================================================
   How to play — a standalone, animated walkthrough.

   Deliberately independent of the game: no room, no query, no mutation, no
   auth. It reads the same DATA the engine rules on (`PLOT_CARDS`, `NIGHT_ORDER`,
   `TEAM_COUNTS`, the theme's role list) so the page cannot promise a rule the
   server disagrees with — but it never runs any of it. That keeps this page
   working while the engine is being changed underneath it, and means a broken
   game never takes the instructions down with it.

   Three registers, in order of how people actually learn:
     1. Watch a round happen.        the Stage — animated, steppable scenarios
     2. Meet the cast.               who sees whom on the first night
     3. Look things up.              expansions and the nine plot cards
   ========================================================================== */

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import {
  ArrowRight, Eye, EyeOff, Flame, Moon, ScrollText, Sparkles, Sun, Swords,
  Users, Zap,
} from "lucide-react";
import { THEMES } from "../convex/themes";
import {
  MAX_REJECTS, NIGHT_ORDER, PLOT_CARDS, TEAM_COUNTS, QUEST_SIZES,
  doubleFailQuests, plotCardsPerRound, LADY_MIN_PLAYERS,
} from "../convex/logic";
import { Stage } from "./learn/Stage";
import { prefersReducedMotion, settleWhenUnwatched } from "./motion";
import { SCENARIOS, SCENARIO_GROUPS } from "./learn/scenarios";
import "./learn.css";

const BASE = THEMES.medieval;

/** Good first, evil after — the order the night itself runs in. */
const CAST_ORDER = [
  "merlin", "percival", "guinevere", "tristan", "isolde", "lancelot_good", "servant",
  "assassin", "morgana", "mordred", "oberon", "lancelot_evil", "minion",
] as const;

/** What each role is actually shown on the first night, in one line. */
const SIGHT: Record<string, string> = {
  merlin: "Shown every evil player except Mordred",
  percival: "Shown Merlin and Morgana, but not which is which",
  guinevere: "Shown both Lancelots, but not which side each is on",
  tristan: "Shown Isolde, and nobody else",
  isolde: "Shown Tristan, and nobody else",
  lancelot_good: "Shown nobody. Must always play Succeed",
  servant: "Shown nobody. You have only the conversation to go on",
  assassin: "Shown the other evil players, and makes the final guess",
  morgana: "Shown the other evil players. Looks like Merlin to Percival",
  mordred: "Shown the other evil players. Merlin cannot see you",
  oberon: "Shown nobody, and the other evil players aren't shown you",
  lancelot_evil: "Shown nobody. Must always play Fail",
  minion: "Shown the other evil players",
};

export default function LearnPage() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];

  return (
    <div className="lx">
      <header className="lx-head">
        <a className="vd-pill" href="/">← Back to Decevia</a>
        <h1 className="lx-title">How to play</h1>
        <p className="lx-lede">
          5 to 18 people play on their own phones. Most are on the good team.
          A few are secretly on the evil team, and they know who each other
          are. Five missions decide it — and the group chooses who goes on
          each one, out loud, with no way to prove anything.
        </p>
        <div className="lx-jump">
          <a href="#watch"><Users size={13} /> Watch a round</a>
          <a href="#table"><Swords size={13} /> How many are evil</a>
          <a href="#cast"><Moon size={13} /> The roles</a>
          <a href="#expansions"><Sparkles size={13} /> Add-ons</a>
          <a href="#plots"><Zap size={13} /> Plot cards</a>
        </div>
      </header>

      {/* ------------------------------------------------------ the stage -- */}
      <Section
        id="watch"
        eyebrow="Start here"
        title="Watch a round play out"
        lede="Pick one below and it plays itself, or step through it one moment at a time. Nothing here is a real game — it's a replay."
      >
        <div className="lx-picker">
          {SCENARIO_GROUPS.map((g) => (
            <div key={g.id} className="lx-picker__group">
              <span className="vd-label vd-label--dim">{g.label}</span>
              <div className="lx-picker__row">
                {SCENARIOS.filter((s) => s.group === g.id).map((s) => (
                  <button
                    key={s.id}
                    className={`lx-pick ${s.id === scenarioId ? "is-on" : ""}`}
                    onClick={() => setScenarioId(s.id)}
                  >
                    <span className="lx-pick__name">{s.name}</span>
                    <span className="lx-pick__blurb">{s.blurb}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Stage scenario={scenario} />
      </Section>

      {/* ------------------------------------------------------ the table -- */}
      <Section
        id="table"
        eyebrow="The numbers"
        title="How many people are evil"
        lede="You don't choose this — it's fixed by how many people are playing, and so is the size of each mission team."
      >
        <div className="lx-matrix" role="table">
          <div className="lx-matrix__head" role="row">
            <span>Players</span><span>Good</span><span>Evil</span>
            <span>People per mission (1–5)</span><span>Needs 2 fails</span>
          </div>
          {[5, 6, 7, 8, 9, 10, 12, 15, 18].map((n) => {
            const [good, evil] = TEAM_COUNTS[n];
            const dbl = doubleFailQuests(n).map((q) => q + 1);
            return (
              <div className="lx-matrix__row" role="row" key={n}>
                <span className="lx-matrix__n">{n}</span>
                <span><Sun size={11} /> {good}</span>
                <span className="is-evil"><Flame size={11} /> {evil}</span>
                <span className="lx-matrix__sizes">{QUEST_SIZES[n].join(" · ")}</span>
                <span>{dbl.length ? `mission ${dbl.join(" & ")}` : "none"}</span>
              </div>
            );
          })}
        </div>
        <p className="lx-foot">
          Good wins by getting three missions to succeed. Evil wins by making
          three fail — or by getting {MAX_REJECTS} teams in a row voted down,
          which ends the game without a single mission being played.
        </p>
      </Section>

      {/* ------------------------------------------------------- the night -- */}
      <Section
        id="cast"
        eyebrow="The roles"
        title="Who gets shown what, and when"
        lede="Everything anyone knows for certain comes from this one moment at the start. After it, there is only conversation."
      >
        <ol className="lx-night">
          {NIGHT_ORDER.map((s) => (
            <li key={s.step} className="lx-night__step">
              <span className="lx-night__n">{s.step}</span>
              <span className="lx-night__label">{s.label}</span>
            </li>
          ))}
        </ol>

        <div className="lx-cast">
          {CAST_ORDER.map((id) => {
            const role = BASE.roles.find((r) => r.id === id);
            if (!role) return null;
            const evil = role.team === "evil";
            const sight = SIGHT[id] ?? "";
            const blind = sight.startsWith("Nothing");
            return (
              <article key={id} className={`lx-role ${evil ? "is-evil" : ""}`}>
                <header>
                  {evil ? <Flame size={13} /> : <Sun size={13} />}
                  <h3>{role.name}</h3>
                </header>
                <p className="lx-role__desc vd-lore">{role.desc}</p>
                <div className="lx-role__sees">
                  {blind ? <EyeOff size={12} /> : <Eye size={12} />}
                  <span>{sight}</span>
                </div>
              </article>
            );
          })}
        </div>
        <p className="lx-foot">
          Every setting gives these characters different names. What they can do
          never changes — Krishna is shown exactly what Merlin is shown.
        </p>
      </Section>

      {/* -------------------------------------------------- the expansions -- */}
      <Section
        id="expansions"
        eyebrow="Optional extras"
        title="The three add-ons"
        lede="Each one is switched on separately by the host. Leave them all off and you have the basic game — which is how you should play your first one."
      >
        <div className="lx-cards3">
          <Feature
            icon={<Eye size={18} />}
            name="Lady of the Lake"
            need={`Needs ${LADY_MIN_PLAYERS}+ players`}
            beats={[
              "After missions 2, 3 and 4, one player picks somebody to inspect.",
              "They alone are told whether that person is good or evil — and they can lie about it.",
              "The power then passes to the person they inspected.",
              "Anyone who has ever held it can never be inspected.",
            ]}
          />
          <Feature
            icon={<Swords size={18} />}
            name="Excalibur"
            need="Any group size"
            beats={[
              "When the leader picks a team, they hand Excalibur to one member of it — never themselves.",
              "Once every mission card is in, that person may flip one other team member's card.",
              "Everyone sees who was flipped; only those two ever learn which card it was.",
              "It can rescue a failing mission, or wreck a clean one.",
            ]}
          />
          <Feature
            icon={<Sparkles size={18} />}
            name="The Lancelots"
            need="Any group size"
            beats={[
              "Two players, one good and one evil. Neither knows who the other is.",
              "Neither gets a choice of card: the evil one must play Fail, the good one Succeed.",
              "From round 3 a card is drawn each round — two of the five swap their sides over.",
              "What Merlin was shown never updates, so a swapped Lancelot still looks evil to them.",
            ]}
          />
        </div>
      </Section>

      {/* -------------------------------------------------------- the plots -- */}
      <Section
        id="plots"
        eyebrow="Optional extras"
        title="The nine plot cards"
        lede={`If the host turns these on, the leader deals ${plotCardsPerRound(6)} to ${plotCardsPerRound(10)} face-down cards each round, depending on how many are playing. Everyone can see how many cards you hold; nobody can see which.`}
      >
        {(["instant", "usable", "effect"] as const).map((kind) => {
          const cards = Object.values(PLOT_CARDS).filter((c) => c.kind === kind);
          if (!cards.length) return null;
          return (
            <div key={kind} className="lx-plotgroup">
              <span className="vd-label">
                {kind === "instant" && "Happens the moment you play it"}
                {kind === "usable" && "You hold it and play it at one specific point"}
                {kind === "effect" && "Lasts the rest of the game"}
              </span>
              <div className="lx-plots">
                {cards.map((c) => (
                  <article key={c.id} className={`lx-plot is-${kind}`}>
                    <h3>{c.name}</h3>
                    <p>{c.desc}</p>
                    {c.window !== "none" && (
                      <span className="lx-plot__when">
                        {c.window === "propose"
                          ? "Play while a team is being picked"
                          : c.window === "vote"
                            ? "Play during a vote"
                            : c.window === "quest"
                              ? "Play during a mission"
                              : c.window === "kingReturns"
                                ? "Play just after a vote passes"
                                : `Play at: ${c.window}`}
                      </span>
                    )}
                  </article>
                ))}
              </div>
            </div>
          );
        })}
        <p className="lx-foot">
          Ambush is the only one that leaves no trace — nobody is told it was
          used, and only the person who played it sees the answer.
        </p>
      </Section>

      <footer className="lx-end">
        <a className="lp-act lp-act--primary" href="/play?tab=create">
          Start a game <ArrowRight size={16} />
        </a>
        <a className="vd-textbtn" href="/rules">
          <ScrollText size={13} /> Read the full rules
        </a>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ parts -- */

/** A section that rises into place the first time it is scrolled to. */
function Section({
  id, eyebrow, title, lede, children,
}: {
  id: string; eyebrow: string; title: string; lede: string;
  children: React.ReactNode;
}) {
  const root = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } },
      { rootMargin: "-80px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!seen || !root.current) return;
    const ctx = gsap.context(() => {
      /* A section can cross the observer's threshold while the tab is hidden
         (a page restored mid-scroll, a background load), and then its heading
         is left at opacity 0 with nothing to bring it back. */
      const tl = gsap.timeline().from(".lx-section__head > *", {
        y: 14, opacity: 0, stagger: 0.08, duration: 0.5, ease: "power3.out",
      });
      return settleWhenUnwatched(tl);
    }, root);
    return () => ctx.revert();
  }, [seen]);

  return (
    <section className={`lx-section ${seen ? "is-in" : ""}`} id={id} ref={root}>
      <div className="lx-section__head">
        <span className="vd-label vd-label--brass">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{lede}</p>
      </div>
      {children}
    </section>
  );
}

function Feature({
  icon, name, need, beats,
}: { icon: React.ReactNode; name: string; need: string; beats: string[] }) {
  return (
    <article className="lx-feature">
      <header>
        {icon}
        <h3>{name}</h3>
        <span className="vd-label vd-label--dim">{need}</span>
      </header>
      <ol>
        {beats.map((b, i) => (
          <li key={i}><span>{i + 1}</span>{b}</li>
        ))}
      </ol>
    </article>
  );
}
