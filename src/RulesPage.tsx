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
import {
  DOUBLE_FAIL_QUEST,
  QUEST_SIZES,
  TEAM_COUNTS,
  MAX_REJECTS,
  LADY_MIN_PLAYERS,
  PLOT_CARDS,
  plotCardsPerRound,
  NIGHT_ORDER,
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

/** Roles that come as an inseparable pair. */
const PAIRED: Record<string, string> = {
  tristan: "Always with Isolde",
  isolde: "Always with Tristan",
  lancelot_good: "Always with the fallen Lancelot",
  lancelot_evil: "Always with the loyal Lancelot",
};

const PHASES = [
  { id: "lobby", title: "Council", detail: "5–10 warriors join. Host picks the theme, the optional roles, and any expansions." },
  { id: "reveal", title: "Night", detail: "Visions resolve in a fixed order. Each player sees only their own role and what that role is allowed to know." },
  { id: "plot", title: "Plots", detail: "Plot cards only. At the start of each round the leader deals the round’s cards, face down, to other players." },
  { id: "propose", title: "Propose", detail: "3 minutes to discuss, then 1 extra minute for the leader to lock a war party of the size shown. With Excalibur, the leader also arms one party member." },
  { id: "vote", title: "Vote", detail: "Everyone supports or opposes the party. A strict majority sends them to battle; a tie turns them away." },
  { id: "quest", title: "Quest", detail: "Party members play Success or Fail in secret. Good may only play Success. Then Excalibur, if drawn, may flip one card." },
  { id: "lady", title: "Lady", detail: "After quests 2–4 at 7+ players, the token holder learns one player’s true allegiance and passes the token to them." },
  { id: "end", title: "Victory", detail: "Three successes trigger the Assassin’s strike. Three fails, or five rejected parties, win for Evil." },
];

function roleOf(theme: ThemeConfig, id: string) {
  return theme.roles.find((r) => r.id === id);
}

function seesTargets(viewerId: string): { ids: string[]; note: string } {
  switch (viewerId) {
    case "merlin":
      return {
        ids: ["assassin", "morgana", "oberon", "lancelot_evil", "minion"],
        note: "Sees Evil — except Mordred, who is veiled. A Lancelot who later switches still reads as Evil to Merlin: the vision is a snapshot of the night.",
      };
    case "percival":
      return {
        ids: ["merlin", "morgana"],
        note: "Sees Merlin and Morgana, but cannot tell them apart.",
      };
    case "guinevere":
      return {
        ids: ["lancelot_good", "lancelot_evil"],
        note: "Sees both Lancelots, but not which of them is loyal and which has fallen.",
      };
    case "tristan":
      return { ids: ["isolde"], note: "Knows Isolde. If the Assassin names them both, they die together." };
    case "isolde":
      return { ids: ["tristan"], note: "Knows Tristan. If the Assassin names them both, they die together." };
    case "lancelot_good":
      return {
        ids: [],
        note: "Knows no one — not even the other Lancelot. Only Guinevere marks them. May play only Success.",
      };
    case "lancelot_evil":
      return {
        ids: [],
        note: "Cannot identify their allies, though the other Evil players recognise them. Merlin and Guinevere both see them. Must play Fail.",
      };
    case "assassin":
    case "morgana":
    case "mordred":
    case "minion":
      return {
        ids: ["assassin", "morgana", "mordred", "lancelot_evil", "minion"].filter(
          (id) => id !== viewerId,
        ),
        note: "Sees fellow Evil — except Oberon, who walks alone. The fallen Lancelot is recognised but does not recognise anyone back.",
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
              <li>{MAX_REJECTS} parties are rejected in a row, or</li>
              <li>Three quests succeed but the Assassin correctly names Merlin.</li>
              <li>
                With the lovers in play, the Assassin may instead name{" "}
                <strong>both</strong> Tristan and Isolde. Both right wins for
                Evil; either wrong wins for Good.
              </li>
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
          Always in the deck: <strong>Merlin</strong> and the{" "}
          <strong>Assassin</strong>. Optional roles fill the remaining seats and
          can never exceed them — Percival, Guinevere and the loyal Lancelot take
          one Good seat each, the lovers take two, and Morgana, Mordred, Oberon
          and the fallen Lancelot take one Evil seat each. Because the Lancelots
          are a pair, enabling them costs one seat on <em>each</em> side.
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

      <section id="night" className="rules-section">
        <h2>The order of the night</h2>
        <p>
          Visions always resolve in this sequence. Steps whose role is not in the
          game are simply skipped.
        </p>
        <ol className="rules-flow">
          {NIGHT_ORDER.map((stp, i) => (
            <li key={stp.step} className="rules-flow__step">
              <span className="rules-flow__num">{stp.step}</span>
              <div>
                <strong>{stp.label}</strong>
              </div>
              {i < NIGHT_ORDER.length - 1 && (
                <ArrowRight className="rules-flow__arrow" size={16} />
              )}
            </li>
          ))}
        </ol>
      </section>

      <section id="lancelot" className="rules-section">
        <h2>The Lancelots &amp; the loyalty deck</h2>
        <p>
          Enabling Lancelot puts <strong>two</strong> players in the game: one
          Good, one Evil. Neither knows the other. They are the only roles whose
          mission card is <em>forced</em> — the Evil Lancelot must play{" "}
          <strong>Fail</strong> and the Good Lancelot must play{" "}
          <strong>Success</strong>, every single quest they ride on.
        </p>
        <div className="rules-callouts">
          <article>
            <Swords size={18} />
            <h3>Five cards, two switches</h3>
            <p>
              The loyalty deck holds 5 cards: 2 switch allegiance, 3 do nothing.
              One is drawn at the start of every round from the{" "}
              <strong>third</strong> onward.
            </p>
          </article>
          <article>
            <Eye size={18} />
            <h3>A switch flips both</h3>
            <p>
              When a switch is drawn, both Lancelots trade sides — and their
              forced mission cards trade with them. The draw is public; who
              switched is not a secret, but what it means for the table is.
            </p>
          </article>
          <article>
            <EyeOff size={18} />
            <h3>Merlin’s vision does not update</h3>
            <p>
              Merlin saw the Evil Lancelot on night one and still reads them as
              Evil afterwards, even once they have turned Good. Guinevere has the
              same problem from the other direction: she knows <em>who</em> the
              Lancelots are and never which side either is on.
            </p>
          </article>
        </div>
      </section>

      <section id="expansions" className="rules-section">
        <h2>Expansions</h2>
        <p>
          Each is an independent host toggle. Every world renames them — the
          rules below are the same underneath.
        </p>

        <div className="rules-callouts">
          <article>
            <Eye size={18} />
            <h3>Lady of the Lake</h3>
            <p>
              Needs <strong>{LADY_MIN_PLAYERS}+ players</strong>. The token
              starts with the player to the first leader’s right. After quests 2,
              3 and 4 the holder picks someone, learns their{" "}
              <strong>true current allegiance</strong> — Lancelot switches
              included — and then passes the token to that person. Anyone who has
              ever held the token can never be examined.
            </p>
          </article>
          <article>
            <Swords size={18} />
            <h3>Excalibur</h3>
            <p>
              When the leader proposes a party they must also hand Excalibur to
              one party member other than themselves. After every mission card is
              in, the holder may turn <strong>one</strong> companion’s card to its
              opposite. The table learns <em>who</em> was struck; only the holder
              and the target ever learn what the card had been.
            </p>
          </article>
          <article>
            <ScrollText size={18} />
            <h3>Plot cards</h3>
            <p>
              At the start of each round the leader deals{" "}
              <strong>{plotCardsPerRound(players)}</strong> card
              {plotCardsPerRound(players) === 1 ? "" : "s"} at {players} players
              — face down, never to themselves. Who holds how many is public;
              which cards they are is not.
            </p>
          </article>
        </div>

        <div className="rules-map">
          <div className="rules-map__head">
            <span>Plot card</span>
            <ArrowRight size={14} />
            <span>What it does</span>
          </div>
          {Object.values(PLOT_CARDS).map((c) => (
            <div key={c.id} className="rules-map__row">
              <span className="rules-map__base">{c.name}</span>
              <ArrowRight size={14} className="rules-map__arrow" />
              <span className="rules-map__themed">{c.desc}</span>
              <span className="rules-map__team">
                {c.kind === "instant"
                  ? "resolves at once"
                  : c.kind === "effect"
                    ? "lasts all game"
                    : `play during ${c.window}`}
              </span>
            </div>
          ))}
        </div>
        <p className="rules-note">
          <strong>Ambush</strong> is the one plot card that leaves no public
          trace — the peek is never announced, and only the player who used it
          ever sees the result. Everything else appears in the plots log.
        </p>
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
              ) : PAIRED[id] ? (
                <em>Optional — {PAIRED[id]}</em>
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
