import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Crown,
  Eye,
  EyeOff,
  Flame,
  ScrollText,
  Shield,
  Swords,
  Sun,
  Users,
  X,
} from "lucide-react";
import { THEMES, THEME_LIST, type ThemeConfig } from "../convex/themes";
import { DOUBLE_FAIL_QUEST, QUEST_SIZES, TEAM_COUNTS } from "../convex/logic";

const BASE = THEMES.medieval;
const BASE_ROLE_IDS = [
  "merlin",
  "percival",
  "servant",
  "assassin",
  "morgana",
  "mordred",
  "oberon",
  "minion",
] as const;

const PHASES = [
  { id: "lobby", title: "Council", detail: "5–10 warriors join. Host picks theme and optional roles." },
  { id: "reveal", title: "Secret lots", detail: "Each player sees only their own role and the knowledge that role is allowed." },
  { id: "propose", title: "Propose", detail: "3 minutes to discuss, then 1 extra minute for the leader to lock a war party of the size shown." },
  { id: "vote", title: "Vote", detail: "Everyone supports or opposes the party. Majority support sends them to battle." },
  { id: "quest", title: "Quest", detail: "Party members play Success or Fail in secret. Good may only play Success." },
  { id: "end", title: "Victory", detail: "Three successes trigger the Assassin’s strike. Three fails, or five rejected parties, win for Evil." },
];

function roleOf(theme: ThemeConfig, id: string) {
  return theme.roles.find((r) => r.id === id);
}

function seesTargets(viewerId: string): { ids: string[]; note: string } {
  switch (viewerId) {
    case "merlin":
      return {
        ids: ["assassin", "morgana", "oberon", "minion"],
        note: "Sees Evil — except Mordred, who is veiled.",
      };
    case "percival":
      return {
        ids: ["merlin", "morgana"],
        note: "Sees Merlin and Morgana, but cannot tell them apart.",
      };
    case "assassin":
    case "morgana":
    case "mordred":
    case "minion":
      return {
        ids: ["assassin", "morgana", "mordred", "minion"].filter((id) => id !== viewerId),
        note: "Sees fellow Evil — except Oberon, who walks alone.",
      };
    case "oberon":
      return { ids: [], note: "Knows no other Evil. Merlin still sees Oberon." };
    default:
      return { ids: [], note: "No magical sight. Read the table and vote true." };
  }
}

export default function RulesPage() {
  const [themeId, setThemeId] = useState("medieval");
  const [players, setPlayers] = useState(7);
  const theme = THEMES[themeId] ?? BASE;
  const [good, evil] = TEAM_COUNTS[players];
  const quests = QUEST_SIZES[players];
  const evilSpecials = evil - 1;

  const roster = useMemo(
    () =>
      BASE_ROLE_IDS.map((id) => ({
        id,
        base: roleOf(BASE, id)!,
        themed: roleOf(theme, id)!,
      })),
    [theme],
  );

  return (
    <div className="rules-page">
      <header className="rules-hero">
        <a className="rules-back" href="#/">
          ← Back to council
        </a>
        <p className="rules-kicker">
          <ScrollText size={14} /> Laws of the Round Table
        </p>
        <h1>How the war is won</h1>
        <p className="rules-lede">
          Every theme is the same hidden-team game. The <strong>Medieval Kingdom</strong>{" "}
          (Merlin &amp; Arthur) is the rulebook. Other worlds only rename the faces.
        </p>
      </header>

      <section id="how-it-plays" className="rules-section">
        <h2>How a round plays</h2>
        <ol className="rules-flow">
          {PHASES.map((p, i) => (
            <li key={p.id} className="rules-flow__step">
              <span className="rules-flow__num">{i + 1}</span>
              <div>
                <strong>{p.title}</strong>
                <p>{p.detail}</p>
              </div>
              {i < PHASES.length - 1 && (
                <ArrowRight className="rules-flow__arrow" size={16} />
              )}
            </li>
          ))}
        </ol>

        <div className="rules-callouts">
          <article>
            <Users size={18} />
            <h3>Propose</h3>
            <p>
              The table gets 3 minutes to talk, then 1 extra minute for the
              leader to lock the party. Tap warriors until the count matches
              this quest’s size, then put it to a vote. If time runs out, the
              leader plus the next seated warriors are sent to the council.
            </p>
          </article>
          <article>
            <Shield size={18} />
            <h3>Vote</h3>
            <p>
              Majority <em>Support</em> → the party rides. Majority{" "}
              <em>Oppose</em> (or a tie) → the party is turned away, the crown
              passes, and a reject pip fills.
            </p>
          </article>
          <article>
            <Swords size={18} />
            <h3>Quest cards</h3>
            <p>
              Knights of Arthur may play only <strong>Success</strong>. Minions
              of Mordred may play Success or Fail. Cards are secret until the
              quest resolves.
            </p>
          </article>
        </div>
      </section>

      <section id="winning" className="rules-section">
        <h2>How you win</h2>
        <div className="rules-win">
          <div className="rules-win__card rules-win__card--good">
            <Sun size={22} />
            <h3>Good prevails</h3>
            <p>Three quests succeed, <em>and</em> the Assassin names the wrong soul (not Merlin).</p>
          </div>
          <div className="rules-win__card rules-win__card--evil">
            <Flame size={22} />
            <h3>Evil triumphs</h3>
            <ul>
              <li>Three quests fail, or</li>
              <li>Five parties are rejected in a row, or</li>
              <li>Three quests succeed but the Assassin correctly names Merlin.</li>
            </ul>
          </div>
        </div>
        <p className="rules-note">
          Quest {DOUBLE_FAIL_QUEST + 1} (the fourth) needs <strong>two Fail cards</strong> to
          fail when there are 7 or more players. With 5–6 players, a single Fail still ruins it.
        </p>
      </section>

      <section id="table-size" className="rules-section">
        <h2>Table size &amp; party counts</h2>
        <p>
          Always in the deck: <strong>Merlin</strong> and the <strong>Assassin</strong>. Optional
          specials (Percival, Morgana, Mordred, Oberon) fill remaining seats. Evil specials
          cannot exceed Evil seats minus the Assassin.
        </p>
        <div className="rules-size-picker">
          <span>Warriors at the table</span>
          <div className="rules-size-picker__btns">
            {[5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                type="button"
                className={n === players ? "is-on" : ""}
                onClick={() => setPlayers(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="rules-split">
          <div className="rules-pill rules-pill--good">
            <Sun size={16} /> {good} Good
          </div>
          <div className="rules-pill rules-pill--evil">
            <Flame size={16} /> {evil} Evil
          </div>
          <div className="rules-pill">
            <Crown size={16} /> {evilSpecials} evil special{evilSpecials === 1 ? "" : "s"} besides Assassin
          </div>
        </div>
        <div className="rules-quests">
          {quests.map((size, i) => (
            <div
              key={i}
              className={`rules-gem ${i === DOUBLE_FAIL_QUEST && players >= 7 ? "rules-gem--double" : ""}`}
            >
              <span>Q{i + 1}</span>
              <strong>{size}</strong>
              <em>on party</em>
              {i === DOUBLE_FAIL_QUEST && players >= 7 && (
                <b>2 fails to sink</b>
              )}
            </div>
          ))}
        </div>
      </section>

      <section id="sight" className="rules-section">
        <h2>Who sees whom</h2>
        <p>
          Knowledge is named in Medieval terms. In other themes the same arrows apply to the
          mapped characters.
        </p>
        <div className="rules-sight">
          {BASE_ROLE_IDS.map((id) => {
            const viewer = roleOf(BASE, id)!;
            const { ids, note } = seesTargets(id);
            return (
              <div key={id} className={`rules-sight__row team-${viewer.team}`}>
                <div className="rules-sight__who">
                  {viewer.team === "good" ? <Sun size={14} /> : <Flame size={14} />}
                  <strong>{viewer.name}</strong>
                </div>
                <p className="rules-sight__note">{note}</p>
                <div className="rules-sight__sees">
                  {ids.length === 0 ? (
                    <span className="rules-chip rules-chip--empty">
                      <EyeOff size={12} /> no one
                    </span>
                  ) : (
                    ids.map((tid) => (
                      <span key={tid} className="rules-chip">
                        <Eye size={12} /> {roleOf(BASE, tid)!.name}
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="roles" className="rules-section">
        <h2>Base characters (Medieval)</h2>
        <div className="rules-roles">
          {roster.map(({ id, base }) => (
            <article key={id} className={`rules-role team-${base.team}`}>
              <header>
                {base.team === "good" ? <Sun size={16} /> : <Flame size={16} />}
                <h3>{base.name}</h3>
                <span>{base.team === "good" ? "Good" : "Evil"}</span>
              </header>
              <p>{base.desc}</p>
              {id === "merlin" || id === "assassin" ? (
                <em className="rules-always">Always in play</em>
              ) : id === "servant" || id === "minion" ? (
                <em>Fills remaining seats</em>
              ) : (
                <em>Optional — host toggle</em>
              )}
            </article>
          ))}
        </div>
      </section>

      <section id="themes" className="rules-section">
        <h2>The same roles, other worlds</h2>
        <p>
          Pick a theme. The left name is the rulebook (Medieval). The right name is who you
          will see in that world.
        </p>
        <div className="theme-row rules-theme-row">
          {THEME_LIST.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`rules-theme-btn ${t.id === themeId ? "is-on" : ""}`}
              onClick={() => setThemeId(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
        <p className="rules-theme-tag">
          <strong>{theme.name}</strong> — {theme.goodTeamName} vs {theme.evilTeamName}. {theme.tagline}
        </p>
        <div className="rules-map">
          <div className="rules-map__head">
            <span>Medieval (rules)</span>
            <ArrowRight size={14} />
            <span>{theme.name}</span>
          </div>
          {roster.map(({ id, base, themed }) => (
            <div key={id} className={`rules-map__row team-${base.team}`}>
              <span className="rules-map__base">{base.name}</span>
              <ArrowRight size={14} className="rules-map__arrow" />
              <span className="rules-map__themed">{themed.name}</span>
              <span className={`rules-map__team team-${base.team}`}>
                {base.team === "good" ? <Check size={12} /> : <X size={12} />}
                {base.team}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
