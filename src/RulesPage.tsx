import { useMemo, useState } from "react";
import {
  ArrowLeft, Check, Crown, Eye, EyeOff, Flame, ScrollText, Shield, Swords,
  Sun, Users, X,
} from "lucide-react";
import { THEMES, THEME_LIST, type ThemeConfig } from "../convex/themes";
import {
  doubleFailQuests, MAX_PLAYERS, QUEST_SIZES, TEAM_COUNTS, MAX_REJECTS,
  LADY_MIN_PLAYERS, PLOT_CARDS, plotCardsPerRound, NIGHT_ORDER,
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
  tristan: "always comes with Isolde",
  isolde: "always comes with Tristan",
  lancelot_good: "always comes with the evil Lancelot",
  lancelot_evil: "always comes with the good Lancelot",
};

const PHASES = [
  { id: "lobby", title: "Setting up", detail: "Everyone joins with the same 4-letter code. The host picks the setting and any optional roles or add-ons." },
  { id: "reveal", title: "Secret roles", detail: "Each player is shown their own role, and only what that role is allowed to know. The order this happens in is fixed." },
  { id: "plot", title: "Plot cards", detail: "Only if the host turned them on. At the start of each round the leader deals that round's cards face down to other players." },
  { id: "propose", title: "Picking a team", detail: "Everyone gets 3 minutes to talk, then the leader has 1 minute to choose a team of the size the board shows. With Excalibur on, they also choose who carries it." },
  { id: "vote", title: "Voting", detail: "Everyone votes yes or no on that team — not just the people on it. More yes than no and the team goes; a tie counts as no." },
  { id: "quest", title: "The mission", detail: "Only the people on the team play a card, in secret: Succeed or Fail. Good players can only play Succeed, unless the host turned on the house rule. Excalibur, if in play, can then flip one card." },
  { id: "lady", title: "Lady of the Lake", detail: "Only with 7 or more players and the add-on on. After missions 2, 3 and 4 one player privately learns somebody's real side, then hands the power to that person." },
  { id: "end", title: "Winning", detail: "Once three missions succeed, the evil team gets one guess at who Merlin is. Three failed missions, or five teams voted down in a row, wins outright for evil." },
];

const SECTIONS = [
  { id: "how-it-plays", label: "How a round works" },
  { id: "winning", label: "How you win" },
  { id: "table-size", label: "Team sizes" },
  { id: "beyond-ten", label: "More than 10 players" },
  { id: "sight", label: "Who knows what" },
  { id: "night", label: "Order roles are shown" },
  { id: "lancelot", label: "The Lancelots" },
  { id: "expansions", label: "Add-ons" },
  { id: "roles", label: "All the roles" },
  { id: "themes", label: "Settings" },
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
    <div className="vd-board">
      <div className="vd-content vd-page">
        <div className="vd-page__back">
          <a className="vd-pill" href="/play"><ArrowLeft size={13} /> Back to the game</a>
          <a className="vd-pill" href="/learn">See a round played out</a>
        </div>

        <header className="vd-page__head">
          <span className="vd-label vd-label--brass"><ScrollText size={13} /> Full rules</span>
          <h1 className="vd-hero">How the game works</h1>
          <p className="vd-voice">
            All five settings are the same game with different character names.
            These rules use the <strong>Medieval Kingdom</strong> names
            (Merlin, Arthur, Mordred) throughout. If you'd rather watch a round
            play out than read, try <a href="/learn">how to play</a> first.
          </p>
        </header>

        <nav className="vd-toc" aria-label="Jump to a section">
          <span className="vd-label" style={{ width: "100%" }}>Jump to</span>
          {SECTIONS.map((s) => (
            <a key={s.id} className="vd-pill" href={`#${s.id}`}>{s.label}</a>
          ))}
        </nav>

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
                The table gets 4 minutes to talk, then the leader has 1 more
                minute to lock in a team. They tap names until the count matches
                the size shown, then send it to a vote. If the minute runs out,
                the leader loses their turn: the next player picks instead, for
                the same mission. A missed turn does <em>not</em> count as a
                team being voted down.
              </p>
            </div>
            <div className="vd-panel">
              <Shield size={18} color="var(--vd-brass)" />
              <h3 className="vd-h3" style={{ margin: "8px 0" }}>Voting</h3>
              <p className="vd-voice" style={{ margin: 0 }}>
                More <strong>yes</strong> than <strong>no</strong> and the team
                goes on the mission. More no, or a tie, and the team is turned
                down: the next player becomes leader and one of the five
                rejection markers fills up.
              </p>
            </div>
            <div className="vd-panel">
              <Swords size={18} color="var(--vd-brass)" />
              <h3 className="vd-h3" style={{ margin: "8px 0" }}>Mission cards</h3>
              <p className="vd-voice" style={{ margin: 0 }}>
                Good players can only play <strong>Succeed</strong>. Evil
                players can play either. Cards stay secret, and when they are
                turned over you only learn how many Fails there were — never
                who played them.
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
                  With the lovers in play, evil can instead guess{" "}
                  <strong>both</strong> Tristan and Isolde. Both right and evil
                  wins; either one wrong and good wins.
                </li>
              </ul>
            </div>
          </div>
          <p className="vd-voice" style={{ marginTop: 16 }}>
            One exception: with 7 or more players, mission 4 needs{" "}
            <strong>two Fail cards</strong> to fail, not one. With 5 or 6
            players a single Fail is still enough. Above 10 players, mission 3
            needs two as well — see <em>More than 10 players</em> below.
          </p>
        </section>

        <section id="table-size" className="vd-page__section">
          <h2 className="vd-h1">How many people, and how big each team is</h2>
          <p className="vd-voice" style={{ marginTop: 12 }}>
            <strong>Merlin</strong> and the <strong>Assassin</strong> are always
            in the game. Any optional roles you turn on take up the remaining
            places, and you can never have more roles than players. Percival,
            Guinevere and the good Lancelot each take one good place; the lovers
            take two; Morgana, Mordred, Oberon and the evil Lancelot each take
            one evil place. The Lancelots come as a pair, so turning them on
            costs one place on <em>each</em> side.
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

        <section id="beyond-ten" className="vd-page__section">
          <h2 className="vd-h1">More than 10 players</h2>
          <p className="vd-voice" style={{ marginTop: 12 }}>
            The printed board game only covers 5 to 10 players, and says nothing
            about team sizes above that. This app goes up to{" "}
            <strong>{MAX_PLAYERS}</strong>, so rather than invent numbers we
            carried on the same arithmetic the printed table already uses.
          </p>
          <div className="vd-grid3" style={{ marginTop: 20 }}>
            <div className="vd-panel">
              <Flame size={18} color="var(--vd-brass)" />
              <h3 className="vd-h3" style={{ margin: "8px 0" }}>How many are evil</h3>
              <p className="vd-voice" style={{ margin: 0 }}>
                <code>ceil(n / 3)</code>. That reproduces every official row exactly
                — 5→2, 6→2, 7→3, 8→3, 9→3, 10→4 — so above ten it simply keeps
                going. Good takes the rest.
              </p>
            </div>
            <div className="vd-panel">
              <Users size={18} color="var(--vd-brass)" />
              <h3 className="vd-h3" style={{ margin: "8px 0" }}>How big each mission is</h3>
              <p className="vd-voice" style={{ margin: 0 }}>
                The printed sizes sit flat at <code>3 4 4 5 5</code> from 8 to
                10 players, so every further three players adds one to each
                mission. Eleven players sends 4/5/5/6/6; eighteen sends
                6/7/7/8/8.
              </p>
            </div>
            <div className="vd-panel">
              <Shield size={18} color="var(--vd-brass)" />
              <h3 className="vd-h3" style={{ margin: "8px 0" }}>Missions needing two Fails</h3>
              <p className="vd-voice" style={{ margin: 0 }}>
                Above 10 players, mission 3 joins mission 4 in needing two Fail
                cards. Teams get bigger as the group does, so otherwise a single
                saboteur would be on almost every mission.
              </p>
            </div>
          </div>
          <p className="vd-voice" style={{ marginTop: 16 }}>
            Nothing changes at 5 to 10 players — those always use the printed
            numbers. Worth knowing before you invite eighteen people: the game
            is still only five missions long, so at the biggest sizes plenty of
            players never go on one. Every game can seat all eighteen; group
            size is not part of the paid plan.
          </p>
        </section>

        <section id="sight" className="vd-page__section">
          <h2 className="vd-h1">Who knows what</h2>
          <p className="vd-voice" style={{ marginTop: 12 }}>
            Everything anyone knows for certain comes from the moment roles are
            handed out. After that it is all talk. The names below are the
            Medieval ones; the same applies to the matching characters in every
            other setting.
          </p>
          <div className="vd-stack" style={{ marginTop: 16 }}>
            {BASE_ROLE_IDS.map((id) => {
              const viewer = roleOf(BASE, id)!;
              const { ids, note } = seesTargets(id);
              return (
                <div
                  key={id}
                  className="vd-panel"
                  style={{ borderLeft: `3px solid ${viewer.team === "good" ? "var(--vd-brass)" : "var(--vd-red)"}` }}
                >
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
              );
            })}
          </div>
        </section>

        <section id="night" className="vd-page__section">
          <h2 className="vd-h1">The order roles are shown</h2>
          <p className="vd-voice" style={{ marginTop: 12 }}>
            This always happens in the same order. Any step whose role isn't in
            your game is skipped. Knowing which step was yours tells you
            something about the others, which is why the app shows you the list.
          </p>
          <ol className="vd-stack" style={{ marginTop: 16, listStyle: "none", padding: 0 }}>
            {NIGHT_ORDER.map((stp) => (
              <li key={stp.step} className="vd-row" style={{ gap: 14 }}>
                <span className="vd-numeral" style={{ fontSize: 18, color: "var(--vd-brass)", minWidth: 22 }}>
                  {stp.step}
                </span>
                <strong>{stp.label}</strong>
              </li>
            ))}
          </ol>
        </section>

        <section id="lancelot" className="vd-page__section">
          <h2 className="vd-h1">The Lancelots</h2>
          <p className="vd-voice" style={{ marginTop: 12 }}>
            Turning Lancelot on adds <strong>two</strong> players to the game:
            one good, one evil. Neither knows who the other is. They are the
            only roles with no choice of mission card — the evil Lancelot must
            always play <strong>Fail</strong> and the good one must always play{" "}
            <strong>Succeed</strong>, on every mission they go on.
          </p>
          <div className="vd-grid3" style={{ marginTop: 20 }}>
            <div className="vd-panel">
              <Swords size={18} color="var(--vd-brass)" />
              <h3 className="vd-h3" style={{ margin: "8px 0" }}>Five cards, two of them swaps</h3>
              <p className="vd-voice" style={{ margin: 0 }}>
                From round <strong>3</strong> onwards, one card is drawn at the
                start of each round out of a deck of five: two swap the sides
                over, three do nothing.
              </p>
            </div>
            <div className="vd-panel">
              <Eye size={18} color="var(--vd-brass)" />
              <h3 className="vd-h3" style={{ margin: "8px 0" }}>A swap moves both of them</h3>
              <p className="vd-voice" style={{ margin: 0 }}>
                When a swap card comes up, both Lancelots change sides — and so
                do the cards they are forced to play. Everyone sees that a swap
                happened; nobody but the two of them knows what it means.
              </p>
            </div>
            <div className="vd-panel">
              <EyeOff size={18} color="var(--vd-brass)" />
              <h3 className="vd-h3" style={{ margin: "8px 0" }}>What Merlin saw doesn't update</h3>
              <p className="vd-voice" style={{ margin: 0 }}>
                Merlin was shown the evil Lancelot at the start and still
                believes they are evil, even after they have turned good.
                Guinevere has the opposite problem: she knows <em>who</em> the
                two Lancelots are and never which side either is on.
              </p>
            </div>
          </div>
        </section>

        <section id="expansions" className="vd-page__section">
          <h2 className="vd-h1">Add-ons</h2>
          <p className="vd-voice" style={{ marginTop: 12 }}>
            Three extra twists, each switched on separately by the host. Turn
            them all off and you have the basic game, which is the right way to
            play your first one. Every setting gives them different names; the
            rules underneath are the same.
          </p>
          <div className="vd-grid3" style={{ marginTop: 20 }}>
            <div className="vd-panel">
              <Eye size={18} color="var(--vd-brass)" />
              <h3 className="vd-h3" style={{ margin: "8px 0" }}>Lady of the Lake</h3>
              <p className="vd-voice" style={{ margin: 0 }}>
                Needs <strong>{LADY_MIN_PLAYERS} or more players</strong>. It
                starts with the player to the first leader's right. After
                missions 2, 3 and 4 whoever holds it picks somebody and is
                privately told whether that person is good or evil{" "}
                <strong>right now</strong> — so a Lancelot who has swapped
                shows their new side. The power then passes to the person they
                picked, and anyone who has ever held it can never be picked
                again.
              </p>
            </div>
            <div className="vd-panel">
              <Swords size={18} color="var(--vd-brass)" />
              <h3 className="vd-h3" style={{ margin: "8px 0" }}>Excalibur</h3>
              <p className="vd-voice" style={{ margin: 0 }}>
                Whenever the leader picks a team they must also hand Excalibur
                to one member of it — never themselves. Once every mission card
                is in, that person may flip <strong>one</strong> other team
                member's card to the opposite. Everyone sees <em>who</em> was
                flipped; only those two ever learn what the card had been.
              </p>
            </div>
            <div className="vd-panel">
              <ScrollText size={18} color="var(--vd-brass)" />
              <h3 className="vd-h3" style={{ margin: "8px 0" }}>Plot cards</h3>
              <p className="vd-voice" style={{ margin: 0 }}>
                At the start of each round the leader deals{" "}
                <strong>{plotCardsPerRound(players)}</strong> card
                {plotCardsPerRound(players) === 1 ? "" : "s"} face down (at{" "}
                {players} players) — never to themselves. Everyone can see how
                many cards each person holds; nobody can see which ones.
              </p>
            </div>
          </div>

          <div className="vd-rowlist vd-rowlist--3col" style={{ marginTop: 20 }}>
            <div className="vd-rowlist__head">
              <span>Plot card</span><span>What it does</span><span>When</span>
            </div>
            {Object.values(PLOT_CARDS).map((c) => (
              <div key={c.id} className="vd-rowlist__row">
                <span>{c.name}</span>
                <span style={{ color: "var(--vd-ink-dim)" }}>{c.desc}</span>
                <span className="vd-label vd-label--dim">
                  {c.kind === "instant"
                    ? "Happens straight away"
                    : c.kind === "effect"
                      ? "Lasts the whole game"
                      : c.window === "propose"
                        ? "While a team is picked"
                        : c.window === "vote"
                          ? "During a vote"
                          : c.window === "quest"
                            ? "During a mission"
                            : c.window === "kingReturns"
                              ? "Just after a vote passes"
                              : `Play during ${c.window}`}
                </span>
              </div>
            ))}
          </div>
          <p className="vd-voice" style={{ marginTop: 16 }}>
            <strong>Ambush</strong> is the only plot card that leaves no trace:
            the look is never announced and only the person who used it sees the
            answer. Every other card shows up in the list of plot cards played.
          </p>
        </section>

        <section id="roles" className="vd-page__section">
          <h2 className="vd-h1">All the roles</h2>
          <p className="vd-voice" style={{ marginTop: 12 }}>
            Shown with their Medieval names. Use the setting picker at the
            bottom of this page to see what each one is called elsewhere.
          </p>
          <div className="vd-grid2" style={{ marginTop: 16 }}>
            {roster.map(({ id, base }) => (
              <div key={id} className={`vd-panel ${base.team === "evil" ? "vd-panel--danger" : ""}`}>
                <div className="vd-row" style={{ marginBottom: 6 }}>
                  {base.team === "good" ? <Sun size={16} color="var(--vd-brass)" /> : <Flame size={16} color="var(--vd-red-ink)" />}
                  <strong style={{ flex: 1 }}>{base.name}</strong>
                  <span className={base.team === "good" ? "vd-pill vd-pill--brass" : "vd-pill vd-pill--danger"}>
                    {base.team === "good" ? "Good" : "Evil"}
                  </span>
                </div>
                <p className="vd-lore" style={{ margin: "0 0 8px", fontSize: 15 }}>{base.desc}</p>
                {id === "merlin" || id === "assassin" ? (
                  <span className="vd-label vd-label--brass">Always in the game</span>
                ) : id === "servant" || id === "minion" ? (
                  <span className="vd-label vd-label--dim">Fills any places left over</span>
                ) : PAIRED[id] ? (
                  <span className="vd-label vd-label--dim">Optional · {PAIRED[id]}</span>
                ) : (
                  <span className="vd-label vd-label--dim">Optional · host turns it on</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section id="themes" className="vd-page__section">
          <h2 className="vd-h1">The same game in five settings</h2>
          <p className="vd-voice" style={{ marginTop: 12 }}>
            Pick one below. The left column is the name used in these rules; the
            right column is the name you'd actually see in that setting. Nothing
            about how the game plays changes.
          </p>
          <div className="vd-row" style={{ marginTop: 16 }}>
            {THEME_LIST.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`vd-pill vd-pill--action ${t.id === themeId ? "is-on" : ""}`}
                onClick={() => setThemeId(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
          <p className="vd-voice" style={{ margin: "16px 0" }}>
            <strong>{theme.name}</strong> — good is {theme.goodTeamName}, evil
            is {theme.evilTeamName}.{" "}
            <span className="vd-lore">{theme.tagline}</span>
          </p>
          <div className="vd-rowlist vd-rowlist--3col">
            <div className="vd-rowlist__head">
              <span>Name in these rules</span><span>Name in {theme.name}</span><span>Side</span>
            </div>
            {roster.map(({ id, base, themed }) => (
              <div key={id} className="vd-rowlist__row">
                <span>{base.name}</span>
                <span style={{ color: "var(--vd-brass)" }}>{themed.name}</span>
                <span className={base.team === "good" ? "vd-pill vd-pill--brass" : "vd-pill vd-pill--danger"}>
                  {base.team === "good" ? <Check size={13} /> : <X size={13} />}{" "}
                  {base.team === "good" ? "Good" : "Evil"}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
