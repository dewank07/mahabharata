/* ============================================================================
   01 · Lobby — including the fifteen-in-the-room case.

   The seal fills with the seated; everyone after that is a watcher in a stable
   queue, promoted automatically when a seat empties. The host can also seat a
   watcher directly. `validateSetup()`'s message is shown verbatim where it
   blocks the start.

   The host builds the game in the full-width strip under the table: the world,
   the optional roles, the expansions, and the house rules — free vs premium per
   FREE_OPT_KEYS / PREMIUM_OPT_KEYS, with the paid ones locked behind the
   host's plan.
   ========================================================================== */

import { useEffect, useState } from "react";
import {
  Check, ChevronDown, Copy, Crown, Flame, Lock, Sparkles, Sun, Swords, Users, X,
} from "lucide-react";
import { ROOMY, useMediaQuery } from "../useMediaQuery";
import {
  PREMIUM_OPT_KEYS, PREMIUM_OPT_LABELS, TEAM_COUNTS, validateSetup,
} from "../../convex/logic";
import { CharacterCard } from "../CharacterCard";
import { characterFor } from "../characters";
import { SeatRing } from "./Parts";
import { ActionLine, Confirm } from "./TableShell";
import { type Room, type TableProps } from "./types";

type Opts = Room["opts"];

/**
 * Each optional role, with what it costs, which side it joins, and the
 * character whose card stands for it.
 *
 * Two of these switch on a PAIR — the lovers, and the two Lancelots. They get
 * ONE card and one toggle: two cards under a single switch would read as two
 * switches. The card is the good half of the pair, under its own name, and the
 * line beneath it names who arrives alongside.
 */
const ROLE_OPTS: Array<{
  key: keyof Opts; side: "good" | "evil"; good: number; evil: number;
  /** Engine role id of the character the card shows. */
  roleId: string;
  label: (rn: (id: string, f: string) => string) => string;
  desc: (rn: (id: string, f: string) => string) => string;
}> = [
  { key: "percival", side: "good", good: 1, evil: 0, roleId: "percival",
    label: (rn) => rn("percival", "Percival"),
    desc: (rn) => `Shown two names \u2014 one is ${rn("merlin", "Merlin")}, one is a fake` },
  { key: "lovers", side: "good", good: 2, evil: 0, roleId: "tristan",
    label: (rn) => `${rn("tristan", "Tristan")} & ${rn("isolde", "Isolde")}`,
    desc: (rn) => `With ${rn("isolde", "Isolde")}. Two good players who trust each other` },
  { key: "lancelot", side: "good", good: 1, evil: 1, roleId: "lancelot_good",
    label: (rn) => `${rn("lancelot_good", "Lancelot")} & ${rn("lancelot_evil", "Lancelot")}`,
    desc: (rn) => `With ${rn("lancelot_evil", "the other Lancelot")}. Their sides can swap mid-game` },
  { key: "guinevere", side: "good", good: 1, evil: 0, roleId: "guinevere",
    label: (rn) => rn("guinevere", "Guinevere"),
    desc: () => "Knows both Lancelots, but not their sides" },
  { key: "morgana", side: "evil", good: 0, evil: 1, roleId: "morgana",
    label: (rn) => rn("morgana", "Morgana"),
    desc: (rn) => `Looks like ${rn("merlin", "Merlin")} to ${rn("percival", "Percival")}` },
  { key: "mordred", side: "evil", good: 0, evil: 1, roleId: "mordred",
    label: (rn) => rn("mordred", "Mordred"),
    desc: (rn) => `Invisible to ${rn("merlin", "Merlin")}` },
  { key: "oberon", side: "evil", good: 0, evil: 1, roleId: "oberon",
    label: (rn) => rn("oberon", "Oberon"),
    desc: () => "Fights alone \u2014 the other traitors do not know them" },
];

export function LobbyScreen({
  room, pid, emblemSrc, account, worlds, act,
  onStart, onSwapSeat, onRemovePlayer, onSetOpts, onChangeTheme,
}: Pick<TableProps, "room" | "pid" | "emblemSrc" | "account" | "worlds" | "act"> & {
  onStart: () => Promise<unknown>;
  onSwapSeat: (watcherId: string, seatedId: string) => Promise<unknown>;
  onRemovePlayer: (targetId: string) => Promise<unknown>;
  onSetOpts: (opts: Opts) => Promise<unknown>;
  onChangeTheme: (themeId: string) => Promise<unknown>;
}) {
  const [copied, setCopied] = useState(false);
  /* The setup was 3,700px of phone scrolling before the Start button. On a
     roomy screen there is space to show all of it at once, and a host
     configuring a game on a laptop should not have to click four times. */
  const roomy = useMediaQuery(ROOMY);
  const isHost = room.hostId === pid;
  const seated = room.seating.seatedCount;
  const opts = room.opts;
  const roomPremium = room.premium.active;

  const rn = (id: string, fallback: string) =>
    room.theme.roles.find((r) => r.id === id)?.name ?? fallback;

  // Seat accounting: Merlin and the Assassin already hold one seat per side.
  const [goodTotal, evilTotal] = TEAM_COUNTS[Math.max(seated, 5)];
  const goodSlots = goodTotal - 1;
  const evilSlots = evilTotal - 1;
  const goodUsed = ROLE_OPTS.reduce((a, o) => a + (opts[o.key] ? o.good : 0), 0);
  const evilUsed = ROLE_OPTS.reduce((a, o) => a + (opts[o.key] ? o.evil : 0), 0);

  const isPaid = (k: string) => (PREMIUM_OPT_KEYS as string[]).includes(k);
  // Locked only while OFF, so an option stranded by a lapsed plan stays clearable.
  const locked = (k: keyof Opts) => !roomPremium && isPaid(k) && !opts[k];
  const stranded = roomPremium
    ? []
    : PREMIUM_OPT_KEYS.filter((k) => opts[k]);

  const toggle = (k: keyof Opts) => {
    const next = { ...opts, [k]: !opts[k] } as Opts;
    return onSetOpts(next);
  };
  const fits = (o: (typeof ROLE_OPTS)[number]) =>
    goodUsed + o.good <= goodSlots && evilUsed + o.evil <= evilSlots;

  /* What each collapsed section says about itself. A host should be able to
     read the whole setup off four closed headers without opening any of
     them — otherwise collapsing has just hidden the thing they came to
     check. */
  const themeSummary = worlds.find((w) => w.id === room.themeId)?.name ?? room.theme.name;
  const onRoleNames = ROLE_OPTS.filter((o) => opts[o.key] === true).map((o) => o.label(rn));
  const rolesSummary = onRoleNames.length ? onRoleNames.join(" · ") : "None";
  const addOnNames = [
    opts.lady === true && (room.theme.expansions?.lady?.name ?? "Lady of the Lake"),
    opts.excalibur === true && (room.theme.expansions?.excalibur?.name ?? "Excalibur"),
    opts.plots === true && (room.theme.expansions?.plots?.name ?? "Plot cards"),
  ].filter(Boolean) as string[];
  const addOnsSummary = addOnNames.length ? addOnNames.join(" · ") : "None";
  const houseSummary = opts.goodMayFail === true ? "Good may sabotage" : "Standard";

  const errors = validateSetup(Math.max(seated, 5), opts);
  const canStart = seated >= 5 && errors.length === 0 && stranded.length === 0;

  const copyInvite = async () => {
    const url = `${window.location.origin}${window.location.pathname}?code=${room.code}`;
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable — the code is on screen anyway */ }
  };

  /* The world / roles / expansions used to live in the 274px sidebar, where
     every label wrapped. They are a full-width strip under the table instead:
     the centre column runs tall and empty in the lobby, and at that width the
     option rows fit on one line each. */
  const setup = (
    <section className="vd-setup">
      <SetupSection title="Setting" summary={themeSummary} startOpen={roomy}>
        <p className="vd-hint" style={{ margin: 0 }}>
          Only changes the character names and the story. Every setting plays
          by exactly the same rules.
        </p>
        <div className="vd-worlds">
          {worlds.map((w) => {
            const on = w.id === room.themeId;
            const paid = !roomPremium && w.id !== "medieval" && !on;
            return (
              <div key={w.id} className="vd-worldcell">
                <button
                  className={`vd-world ${on ? "is-on" : ""}`}
                  disabled={!isHost || paid}
                  aria-pressed={on}
                  onClick={act(() => onChangeTheme(w.id))}
                >
                  <span className="vd-world__body">
                    <span className="vd-world__name">{w.name}</span>
                    <span className="vd-world__sub">
                      Good: {w.goodTeamName} · Evil: {w.evilTeamName}
                    </span>
                  </span>
                  {on
                    ? <span className="vd-opt__lock"><Check size={13} /> In use</span>
                    : paid
                      ? <span className="vd-opt__lock"><Lock size={11} /> Paid</span>
                      : null}
                </button>
                {/* The reason a tile is off used to live only in `title`,
                    which never appears on a phone. */}
                {(paid || !isHost) && (
                  <span className="vd-hint">
                    {paid ? "Included with a paid plan" : "Only the host can change this"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </SetupSection>

      <SetupSection title="Extra roles" summary={rolesSummary} startOpen={roomy}>
        <div className="vd-row" style={{ justifyContent: "flex-end" }}>
          <span className="vd-label vd-label--dim">
            {goodUsed} of {goodSlots} good · {evilUsed} of {evilSlots} evil used
          </span>
        </div>
        <p className="vd-hint" style={{ margin: 0 }}>
          Leave these all off for the simplest game. Each one you turn on gives
          somebody a special power — and takes one place from that side.
        </p>
        {/* The roles a host is choosing between are CHARACTERS, so they are
            shown as the same cards the rest of the app uses. The card itself is
            the switch: one tap is one toggle, and it never flips — there is
            already a place to read what a character does, and a control that
            sometimes turns over and sometimes turns on makes every tap a
            gamble. Every state the old row carried is still here: on, paid,
            no-places-left, and host-only. */}
        <div className="cc-grid cc-grid--md">
          {ROLE_OPTS.map((o) => {
            const on = opts[o.key] === true;
            const lock = locked(o.key);
            const full = !on && !fits(o);
            const blocked = !isHost || lock || full;
            const character = characterFor(room.theme, o.roleId);
            const badge = lock
              ? { label: "Paid", icon: <Lock size={10} /> }
              : on
                ? { label: "On", icon: <Check size={11} />, tone: "on" as const }
                : full
                  ? { label: "No room" }
                  : undefined;
            return (
              <div key={o.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {character ? (
                  <CharacterCard
                    character={character}
                    size="md"
                    mode="select"
                    teams={{ good: room.theme.goodTeamName, evil: room.theme.evilTeamName }}
                    subtitle={o.desc(rn)}
                    badge={badge}
                    selected={on}
                    disabled={blocked}
                    onSelect={act(() => toggle(o.key))}
                  />
                ) : (
                  /* A world that somehow lacks this role still gets a working
                     switch, rather than one silently missing from the setup. */
                  <button
                    className={`vd-opt vd-opt--${o.side} ${on ? "is-on" : ""}`}
                    disabled={blocked}
                    aria-pressed={on}
                    onClick={act(() => toggle(o.key))}
                  >
                    <span className="vd-opt__top">
                      {o.side === "good"
                        ? <Sun size={12} color="var(--vd-brass)" />
                        : <Flame size={12} color="var(--vd-red-ink)" />}
                      <span className="vd-opt__name">{o.label(rn)}</span>
                    </span>
                    <span className="vd-opt__desc">{o.desc(rn)}</span>
                  </button>
                )}
                {/* Why a control is off, under the control, in readable text.
                    It used to be a `title` tooltip only — invisible on touch,
                    which is this app's main surface. */}
                {(lock || full || !isHost) && (
                  <span className="vd-hint">
                    {lock ? "Included with a paid plan"
                      : full ? `No ${o.side} places left — turn something else off first`
                      : "Only the host can change this"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <p className="vd-voice vd-setup__note">
          {rn("merlin", "Merlin")} and {rn("assassin", "the Assassin")} are always
          in the game. Everyone left over is a plain good or evil player.
        </p>
      </SetupSection>

      <SetupSection title="Add-ons" summary={addOnsSummary} startOpen={roomy}>
        <p className="vd-hint" style={{ margin: 0 }}>
          Extra twists on top of the basic game. Skip them on your first play.
        </p>
        <div className="vd-opts">
          {([
            ["lady", room.theme.expansions?.lady?.name ?? "Lady of the Lake",
             "After missions 2, 3 and 4, one player privately learns somebody's real side — and can lie about it"],
            ["excalibur", room.theme.expansions?.excalibur?.name ?? "Excalibur",
             "The leader gives one team member the power to secretly flip another member's card"],
            ["plots", room.theme.expansions?.plots?.name ?? "Plot cards",
             `The leader deals ${seated <= 6 ? "1 card" : seated <= 8 ? "2 cards" : "3 cards"} face down each round that bend the rules`],
          ] as const).map(([key, name, desc]) => {
            const k = key as keyof Opts;
            const on = opts[k] === true;
            const lock = locked(k);
            const tooSmall = key === "lady" && seated < 7 && !on;
            return (
              <div key={key} style={{ display: "flex", flexDirection: "column" }}>
                <button
                  className={`vd-opt ${on ? "is-on" : ""}`}
                  disabled={!isHost || lock || tooSmall}
                  aria-pressed={on}
                  onClick={act(() => toggle(k))}
                >
                  <span className="vd-opt__top">
                    <Sparkles size={12} color="var(--vd-brass)" />
                    <span className="vd-opt__name">{name}</span>
                    {lock ? <span className="vd-opt__lock"><Lock size={11} /> Paid</span>
                      : on ? <span className="vd-opt__lock"><Check size={13} /> On</span> : null}
                  </span>
                  <span className="vd-opt__desc">{desc}</span>
                </button>
                {(lock || tooSmall || !isHost) && (
                  <span className="vd-hint">
                    {lock ? "Included with a paid plan"
                      : tooSmall ? `Needs 7 or more players — you have ${seated}`
                      : "Only the host can change this"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </SetupSection>

      <SetupSection title="House rule" summary={houseSummary} startOpen={roomy}>
        <div className="vd-opts">
          <div style={{ display: "flex", flexDirection: "column" }}>
            <button
              className={`vd-opt ${opts.goodMayFail ? "is-on" : ""}`}
              disabled={!isHost}
              aria-pressed={opts.goodMayFail === true}
              onClick={act(() => toggle("goodMayFail"))}
            >
              <span className="vd-opt__top">
                <Swords size={12} color="var(--vd-red-ink)" />
                <span className="vd-opt__name">Good players may also sabotage</span>
                {opts.goodMayFail
                  ? <span className="vd-opt__lock"><Check size={13} /> On</span>
                  : null}
              </span>
              <span className="vd-opt__desc">
                Normally only evil players can play a Fail card. Turn this on
                and a Fail no longer proves anyone is evil.
              </span>
            </button>
            {!isHost && <span className="vd-hint">Only the host can change this</span>}
          </div>
        </div>
      </SetupSection>
    </section>
  );

  return (
    <>
    <div className="vd-table vd-table-layout">
      {/* ------------------------------- left ------------------------------ */}
      <div className="vd-stack">
        {/* What the table is trying to do. The lobby used to explain the
            setup options in detail and never once say what the game is. */}
        <div className="vd-goal">
          <span className="vd-label">The goal</span>
          <ul className="vd-goal__list">
            <li>
              Five missions. <b>Good wins</b> if three succeed, <b>evil wins</b>{" "}
              if three fail.
            </li>
            <li>Each round the leader picks a team and everyone votes on it.</li>
            <li>Only the people on a mission decide if it succeeds.</li>
          </ul>
          <a className="vd-textbtn" href="/learn" style={{ marginTop: 4 }}>
            See a round played out
          </a>
        </div>

        <div className="vd-studded vd-panel vd-panel--strong">
          <span className="vd-stud-b" aria-hidden />
          <div className="vd-label">People in</div>
          <div className="vd-numeral" style={{ fontSize: 44, marginTop: 6 }}>{seated}</div>
          <div className="vd-label" style={{ marginTop: 8 }}>
            {seated < 5 ? `${5 - seated} more needed` : `up to ${room.seating.cap} can play`}
          </div>
        </div>

        <div className="vd-invite">
          <div>
            <div className="vd-label">Game code</div>
            <div className="vd-invite__code">{room.code}</div>
          </div>
          <button className="vd-invite__btn" onClick={() => void copyInvite()}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Link copied" : "Copy invite link"}
          </button>
        </div>
        <span className="vd-hint" style={{ marginTop: -8 }}>
          Send the link, or read out the four letters.
        </span>

        <div className="vd-stack vd-stack--tight">
          <span className="vd-label">Who's here ({room.players.length})</span>
          {room.players.map((p) => (
            <div key={p.playerId} className="vd-tile">
              <span className="vd-tile__seat">{p.seat + 1}</span>
              {p.name}
              <span className="vd-tile__meta">
                {p.isHost ? "Host" : ""}{p.isHost && p.playerId === pid ? " · " : ""}
                {p.playerId === pid ? "You" : ""}
              </span>
              {/* Frees the seat and the name together, so a ghost left by a
                  dead tab can walk back in under the same one. */}
              {isHost && p.playerId !== pid && (
                <Confirm
                  className="vd-tile__x"
                  compact
                  icon={<X size={12} />}
                  label="Remove"
                  ariaLabel={`Remove ${p.name} from the game`}
                  ask={`Remove ${p.name} from the game? They can join again with the same code.`}
                  onConfirm={act(() => onRemovePlayer(p.playerId)) as () => Promise<unknown>}
                />
              )}
            </div>
          ))}
        </div>

        <p className="vd-voice">
          Between 5 and {room.premium.seatCap} people can play. Anyone who
          joins after that watches along and takes the next free place.
        </p>
      </div>

      {/* ------------------------------ centre ----------------------------- */}
      <div className="vd-centre">
        <SeatRing
          room={room}
          emblemSrc={emblemSrc}
          stateFor={(p) => (p.playerId === pid ? "leader" : "idle")}
          /* Every non-host seat used to be labelled with a Roman numeral —
             "II", "III", "IV" — which reads as a fact about that player and
             is really just their seat index. Only the two labels that mean
             something to a person are kept. */
          noteFor={(p) =>
            p.isHost ? (p.playerId === pid ? "Host · you" : "Host")
              : p.playerId === pid ? "You" : undefined
          }
        />

        <div className="vd-centre__wide vd-actionbar">
          {stranded.length > 0 && (
            <div className="vd-panel vd-panel--danger" style={{ marginBottom: 12 }}>
              <p className="vd-voice" style={{ margin: 0, color: "var(--vd-red-ink)" }}>
                {stranded.map((k) => PREMIUM_OPT_LABELS[k] ?? k).join(", ")}{" "}
                {stranded.length === 1 ? "needs" : "need"} a paid plan, and this
                game doesn't have one. Turn{" "}
                {stranded.length === 1 ? "it" : "them"} off below to carry on,
                or get a plan.
              </p>
            </div>
          )}

          {/* The validator speaks for itself — shown verbatim. */}
          {errors.length > 0 && (
            <div className="vd-panel vd-panel--danger" style={{ marginBottom: 12 }}>
              {errors.map((e) => (
                <p key={e} className="vd-voice" style={{ margin: 0, color: "var(--vd-red-ink)" }}>{e}</p>
              ))}
            </div>
          )}

          {isHost ? (
            <>
              <ActionLine
                label="You're the host"
                value={seated < 5 ? `${5 - seated} more needed` : `${seated} ready`}
              />
              <button className="vd-btn vd-btn--primary" disabled={!canStart} onClick={act(onStart)}>
                <span>
                  {seated < 5
                    ? `Waiting for ${5 - seated} more ${5 - seated === 1 ? "person" : "people"}`
                    : errors.length > 0 || stranded.length > 0
                      ? "Fix the setup below to start"
                      : "Start the game"}
                </span>
                <Swords size={16} />
              </button>
              {/* A disabled primary button with no explanation is the most
                  common place a host gets stuck. */}
              <span className="vd-hint">
                {seated < 5
                  ? "Five people is the minimum. Share the code to get more in."
                  : !canStart
                    ? "See the message above — something in the setup doesn't add up."
                    : "This deals everyone a secret role. You can still start over afterwards."}
              </span>
            </>
          ) : (
            <div className="vd-panel">
              <p className="vd-voice" style={{ margin: 0 }}>
                {room.seating.iAmWatching
                  ? "You're watching for now. You'll be given a place as soon as one frees up."
                  : "You're in. Waiting for the host to start the game — nothing for you to do yet."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------- right ----------------------------- */}
      <div className="vd-stack">
          {/* ----------------------------- watchers -------------------------- */}
        <div className="vd-stack vd-stack--tight">
          <div className="vd-row" style={{ justifyContent: "space-between" }}>
            <span className="vd-label"><Users size={13} /> Waiting for a place</span>
            <span className="vd-label vd-label--brass">{room.seating.watcherCount}</span>
          </div>

          {room.watchers.length === 0 ? (
            <p className="vd-voice" style={{ margin: 0 }}>
              Nobody's waiting — everyone who has joined has a place.
            </p>
          ) : (
            <>
              <div className="vd-watchers">
                {room.watchers.map((w, i) => (
                  <div key={w.playerId} className="vd-watcher">
                    <span className="vd-watcher__q">{i + 1}</span>
                    {w.name}
                    {w.playerId === pid && <span className="vd-tile__meta">You</span>}
                    {isHost && (
                      <>
                        <button
                          className="vd-watcher__seat"
                          title={`Give ${w.name} a place, swapping out the last player who joined`}
                          onClick={act(() =>
                            onSwapSeat(w.playerId, room.players[room.players.length - 1].playerId),
                          )}
                        >
                          Give a place
                        </button>
                        <Confirm
                          className="vd-tile__x"
                          compact
                          icon={<X size={12} />}
                          label="Remove"
                          ariaLabel={`Remove ${w.name} from the game`}
                          ask={`Remove ${w.name} from the game? They can join again with the same code.`}
                          onConfirm={act(() => onRemovePlayer(w.playerId)) as () => Promise<unknown>}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
              <p className="vd-voice" style={{ margin: 0 }}>
                People waiting can see the board and hear the room, but they
                get no role and cannot vote. To include everyone, split into
                two groups and run a second game.
              </p>
            </>
          )}
        </div>

        {!roomPremium && isHost && (
          <a className="vd-btn" href="/upgrade" style={{ textDecoration: "none" }}>
            <span>See what a paid plan adds</span>
            <Crown size={16} />
          </a>
        )}
      </div>
    </div>

    {setup}
    </>
  );
}

/**
 * One collapsible block of setup.
 *
 * `startOpen` follows the viewport rather than being remembered, so rotating a
 * phone into a roomy layout opens everything and back closes it again — the
 * alternative is a tablet in landscape showing four collapsed headers for no
 * reason. A host's own toggle wins until the breakpoint itself changes.
 */
function SetupSection({
  title, summary, startOpen, children,
}: {
  title: string;
  summary: string;
  startOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(startOpen);
  useEffect(() => setOpen(startOpen), [startOpen]);

  return (
    <section className={`vd-setup__group ${open ? "is-open" : ""}`}>
      <button
        className="vd-setup__toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="vd-label">{title}</span>
        <span className="vd-setup__summary">{summary}</span>
        <ChevronDown className="vd-setup__chev" size={16} aria-hidden />
      </button>
      {open && <div className="vd-setup__body">{children}</div>}
    </section>
  );
}
