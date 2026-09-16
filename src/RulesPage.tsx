import { useState } from "react";
import {
  ArrowLeft, Crown, Eye, EyeOff, Flame, ScrollText, Shield, Swords, Sun, Users,
} from "lucide-react";
import { THEMES, type ThemeConfig } from "../convex/themes";
import { CharacterCard, CharacterGallery } from "./CharacterCard";
import { Stage } from "./learn/Stage";
import { SCENARIOS, SCENARIO_GROUPS } from "./learn/scenarios";
import "./learn.css";
import { characterFor } from "./characters";
import {
  doubleFailQuests, MAX_PLAYERS, QUEST_SIZES, TEAM_COUNTS, MAX_REJECTS,
} from "../convex/logic";

const BASE = THEMES.medieval;
const BASE_ROLE_IDS = [
  "merlin",
  "percival",
  "guinevere",
  "tristan",
  "isolde",
  "lancelot_good",
  "servant",
  "assassin",
  "morgana",
  "mordred",
  "oberon",
  "lancelot_evil",
  "minion",
] as const;

const PHASES = [
  { id: "lobby", title: "Setting up", detail: "Everyone joins with the same 4-letter code. The host picks the setting and any optional roles." },
  { id: "reveal", title: "Secret roles", detail: "Each player is shown their own role, and only what that role is allowed to know." },
  { id: "propose", title: "Picking a team", detail: "The table talks, then the leader chooses a team of the size the board shows." },
  { id: "vote", title: "Voting", detail: "Everyone votes yes or no on that team — not just the people on it. A tie counts as no." },
  { id: "quest", title: "The mission", detail: "Only the people on the team play a card in secret: Succeed or Fail. Good can only play Succeed." },
  { id: "end", title: "Winning", detail: "Once three missions succeed, the evil team gets one guess at who Merlin is. Three failed missions, or five teams voted down in a row, wins outright for evil." },
];

const SECTIONS = [
  { id: "watch", label: "Watch a round" },
  { id: "how-it-plays", label: "How a round works" },
  { id: "winning", label: "How you win" },
  { id: "table-size", label: "Team sizes" },
  { id: "sight", label: "Who knows what" },
  { id: "roles", label: "All the roles" },
];

function roleOf(theme: ThemeConfig, id: string) {
  return theme.roles.find((r) => r.id === id);
}

function seesTargets(viewerId: string): { ids: string[]; note: string } {
  switch (viewerId) {
    case "merlin":
      return {
        ids: ["assassin", "morgana", "oberon", "lancelot_evil", "minion"],
        note: "Is shown every evil player except Mordred. What Merlin is shown never updates, so a Lancelot who later swaps sides still looks evil to them.",
      };
    case "percival":
      return {
        ids: ["merlin", "morgana"],
        note: "Is shown two names and told that one of them is Merlin — but not which one.",
      };
    case "guinevere":
      return {
        ids: ["lancelot_good", "lancelot_evil"],
        note: "Is shown both Lancelots, but not which one is good and which is evil.",
      };
    case "tristan":
      return { ids: ["isolde"], note: "Knows Isolde. If the evil team correctly guesses both of them, evil wins." };
    case "isolde":
      return { ids: ["tristan"], note: "Knows Tristan. If the evil team correctly guesses both of them, evil wins." };
    case "lancelot_good":
      return {
        ids: [],
        note: "Is shown nobody, not even the other Lancelot. Only Guinevere knows who they are. Can only ever play Succeed.",
      };
    case "lancelot_evil":
      return {
        ids: [],
        note: "Is shown nobody, although the other evil players are shown them. Merlin and Guinevere both know who they are. Must always play Fail.",
      };
    case "assassin":
    case "morgana":
    case "mordred":
    case "minion":
      return {
        ids: ["assassin", "morgana", "mordred", "lancelot_evil", "minion"].filter(
          (id) => id !== viewerId,
        ),
        note: "Is shown the other evil players, except Oberon. The evil Lancelot is shown to them, but is not shown anyone back.",
      };
    case "oberon":
      return { ids: [], note: "Is shown nobody, and the other evil players aren't shown them either. Merlin is still shown Oberon." };
    default:
      return { ids: [], note: "Is shown nothing at all. You have only the conversation to go on." };
  }
}

export default function RulesPage() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const [players, setPlayers] = useState(7);
  const [good, evil] = TEAM_COUNTS[players];
  const quests = QUEST_SIZES[players];
  const evilSpecials = evil - 1;

  return (
    <div className="vd-board">
      <div className="vd-content vd-page">
        <div className="vd-page__back">
          <a className="vd-pill" href="/play"><ArrowLeft size={13} /> Back to the game</a>
        </div>

        <header className="vd-page__head">
          <span className="vd-label vd-label--brass"><ScrollText size={13} /> How to play</span>
          <h1 className="vd-hero">How the game works</h1>
          <p className="vd-voice">
            Watch a round play out, then look anything up. Every setting is the
            same game with different character names; this page uses the{" "}
            <strong>Medieval Kingdom</strong> ones throughout.
          </p>
        </header>

        <nav className="vd-toc" aria-label="Jump to a section">
          <span className="vd-label" style={{ width: "100%" }}>Jump to</span>
          {SECTIONS.map((s) => (
            <a key={s.id} className="vd-pill" href={`#${s.id}`}>{s.label}</a>
          ))}
        </nav>

        {/* The walkthrough that was the whole of /learn. It leads, because
            watching one round land teaches the shape of the game faster than
            any of the prose under it — and the prose is then a reference for
            the thing you have already seen, which is what a reference is for.
            Everything else /learn carried said what these sections say. */}
        <section id="watch" className="vd-page__section">
          <h2 className="vd-h1">Watch a round play out</h2>
          <p className="vd-voice" style={{ marginTop: 12 }}>
            Pick one and it plays itself, or step through it a moment at a time.
            Nothing here is a real game — it is a replay.
          </p>
          <div className="lx-picker" style={{ marginTop: 16 }}>
            {SCENARIO_GROUPS.map((g) => (
              <div key={g.id} className="lx-picker__group">
                <span className="vd-label vd-label--dim">{g.label}</span>
                <div className="lx-picker__row">
                  {SCENARIOS.filter((x) => x.group === g.id).map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      className={`lx-pick ${x.id === scenarioId ? "is-on" : ""}`}
                      onClick={() => setScenarioId(x.id)}
                    >
                      <span className="lx-pick__name">{x.name}</span>
                      <span className="lx-pick__blurb">{x.blurb}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Stage scenario={scenario} />
        </section>

        <section id="how-it-plays" className="vd-page__section">
          <h2 className="vd-h1">How a round works</h2>
          <ol className="vd-stack" style={{ marginTop: 16, listStyle: "none", padding: 0 }}>
            {PHASES.map((p, i) => (
              <li key={p.id} className="vd-row" style={{ alignItems: "flex-start", gap: 14 }}>
                <span className="vd-numeral" style={{ fontSize: 20, color: "var(--vd-brass)", minWidth: 24 }}>
                  {i + 1}
                </span>
                <div>
                  <strong style={{ display: "block", marginBottom: 2 }}>{p.title}</strong>
                  <p className="vd-voice" style={{ margin: 0 }}>{p.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="vd-grid3" style={{ marginTop: 24 }}>
            <div className="vd-panel">
              <Users size={18} color="var(--vd-brass)" />
              <h3 className="vd-h3" style={{ margin: "8px 0" }}>Picking a team</h3>
              <p className="vd-voice" style={{ margin: 0 }}>
                The table talks, then the leader taps names until the count
                matches the size shown and sends it to a vote. A leader who runs
                out of time loses their turn to the next player — that is not a
                team being voted down.
              </p>
            </div>
            <div className="vd-panel">
              <Shield size={18} color="var(--vd-brass)" />
              <h3 className="vd-h3" style={{ margin: "8px 0" }}>Voting</h3>
              <p className="vd-voice" style={{ margin: 0 }}>
                More <strong>yes</strong> than <strong>no</strong> and the team
                goes. More no, or a tie, and the next player becomes leader and
                one of the five rejection markers fills up.
              </p>
            </div>
            <div className="vd-panel">
              <Swords size={18} color="var(--vd-brass)" />
              <h3 className="vd-h3" style={{ margin: "8px 0" }}>Mission cards</h3>
              <p className="vd-voice" style={{ margin: 0 }}>
                Good can only play <strong>Succeed</strong>; evil can play
                either. When the cards turn over you learn how many Fails there
                were — never who played them.
              </p>
            </div>
          </div>
        </section>

        <section id="winning" className="vd-page__section">
          <h2 className="vd-h1">How you win</h2>
          <div className="vd-grid2" style={{ marginTop: 16 }}>
            <div className="vd-panel vd-panel--strong">
              <Sun size={22} color="var(--vd-brass)" />
              <h3 className="vd-h3" style={{ margin: "10px 0" }}>Good wins if…</h3>
              <p className="vd-voice" style={{ margin: 0 }}>
                Three missions succeed <em>and</em> the evil team's final guess
                at who Merlin is turns out to be wrong.
              </p>
            </div>
            <div className="vd-panel vd-panel--danger">
              <Flame size={22} color="var(--vd-red-ink)" />
              <h3 className="vd-h3" style={{ margin: "10px 0" }}>Evil wins if…</h3>
              <ul className="vd-list">
                <li>Three missions fail, or</li>
                <li>{MAX_REJECTS} teams in a row are voted down, or</li>
                <li>Three missions succeed but the evil team correctly guesses who Merlin is.</li>
                <li>
                  With the lovers in play, evil can instead name{" "}
                  <strong>both</strong> Tristan and Isolde.
                </li>
              </ul>
            </div>
          </div>
          <p className="vd-voice" style={{ marginTop: 16 }}>
            One exception: with 7 or more players, mission 4 needs{" "}
            <strong>two Fail cards</strong> to fail, not one. The table below
            marks every mission that does.
          </p>
        </section>

        <section id="table-size" className="vd-page__section">
          <h2 className="vd-h1">How many people, and how big each team is</h2>
          <p className="vd-voice" style={{ marginTop: 12 }}>
            <strong>Merlin</strong> and the <strong>Assassin</strong> are always
            in. Every optional role you turn on takes one of the remaining
            places on its own side, and you can never have more roles than
            players.
          </p>

          <div style={{ marginTop: 20 }}>
            <span className="vd-label">Try it with this many players</span>
            <div className="vd-row" style={{ marginTop: 10 }}>
              {Array.from({ length: MAX_PLAYERS - 4 }, (_, i) => i + 5).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`vd-pill vd-pill--action ${n === players ? "is-on" : ""}`}
                  onClick={() => setPlayers(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="vd-row" style={{ marginTop: 16 }}>
            <span className="vd-pill vd-pill--brass"><Sun size={13} /> {good} good players</span>
            <span className="vd-pill vd-pill--danger"><Flame size={13} /> {evil} evil players</span>
            <span className="vd-pill"><Crown size={13} /> room for {evilSpecials} special evil role{evilSpecials === 1 ? "" : "s"} besides the Assassin</span>
          </div>

          <div className="vd-row" style={{ marginTop: 16, alignItems: "stretch" }}>
            {quests.map((size, i) => {
              const dbl = doubleFailQuests(players).includes(i);
              return (
                <div
                  key={i}
                  className={`vd-panel ${dbl ? "vd-panel--danger" : ""}`}
                  style={{ flex: "1 0 84px", textAlign: "center" }}
                >
                  <span className="vd-label vd-label--dim">Mission {i + 1}</span>
                  <div className="vd-numeral" style={{ fontSize: 26, color: "var(--vd-brass)", margin: "4px 0" }}>{size}</div>
                  <span className="vd-label vd-label--dim">people go</span>
                  {dbl && <div className="vd-label" style={{ color: "var(--vd-red-ink)", marginTop: 6 }}>needs 2 fails</div>}
                </div>
              );
            })}
          </div>
        </section>

        <section id="sight" className="vd-page__section">
          <h2 className="vd-h1">Who knows what</h2>
          <p className="vd-voice" style={{ marginTop: 12 }}>
            Everything anyone knows for certain comes from the moment roles are
            handed out. After that it is all talk.
          </p>
          <div className="vd-stack" style={{ marginTop: 16 }}>
            {BASE_ROLE_IDS.map((id) => {
              const viewer = roleOf(BASE, id)!;
              const character = characterFor(BASE, id);
              const { ids, note } = seesTargets(id);
              return (
                <div
                  key={id}
                  className="vd-panel"
                  style={{ borderLeft: `3px solid ${viewer.team === "good" ? "var(--vd-brass)" : "var(--vd-red)"}` }}
                >
                  <div className="cc-row">
                    {character && (
                      <div className="cc-row__card">
                        <CharacterCard
                          character={character}
                          size="sm"
                          mode="static"
                          teams={{ good: BASE.goodTeamName, evil: BASE.evilTeamName }}
                          hideNote
                        />
                      </div>
                    )}
                    <div className="cc-row__body">
                      <div className="vd-row" style={{ marginBottom: 6 }}>
                        {viewer.team === "good" ? <Sun size={14} color="var(--vd-brass)" /> : <Flame size={14} color="var(--vd-red-ink)" />}
                        <strong>{viewer.name}</strong>
                      </div>
                      <p className="vd-voice" style={{ margin: "0 0 10px" }}>{note}</p>
                      <div className="vd-row">
                        {ids.length === 0 ? (
                          <span className="vd-pill"><EyeOff size={13} /> Is shown nobody</span>
                        ) : (
                          ids.map((tid) => (
                            <span key={tid} className="vd-pill vd-pill--brass">
                              <Eye size={13} /> {roleOf(BASE, tid)!.name}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section id="roles" className="vd-page__section">
          <h2 className="vd-h1">All the roles</h2>
          <p className="vd-voice" style={{ marginTop: 12 }}>
            Tap a character to read what it is told and what it is trying to do.
          </p>
          <div style={{ marginTop: 20 }}>
            <CharacterGallery source={BASE} />
          </div>
        </section>

      </div>
    </div>
  );
}
