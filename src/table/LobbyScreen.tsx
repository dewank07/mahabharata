/* ============================================================================
   01 · Lobby — including the fifteen-in-the-room case.

   The seal fills with the seated; everyone after that is a watcher in a stable
   queue, promoted automatically when a seat empties. The host can also seat a
   watcher directly. `validateSetup()`'s message is shown verbatim where it
   blocks the start.

   The host builds the game in the full-width strip under the table: the world,
   the optional roles, and the expansions — free vs premium per FREE_OPT_KEYS /
   PREMIUM_OPT_KEYS, with the paid ones locked behind the host's plan.
   ========================================================================== */

import { useState } from "react";
import {
  Check, Copy, Crown, Flame, Lock, LogOut, Sparkles, Sun, Swords, Users,
} from "lucide-react";
import {
  PREMIUM_OPT_KEYS, PREMIUM_OPT_LABELS, TEAM_COUNTS, validateSetup,
} from "../../convex/logic";
import { ChronicleColumn, SeatRing } from "./Parts";
import { ActionLine } from "./TableShell";
import { type Room, type TableProps, ROMAN } from "./types";

type Opts = Room["opts"];

/** Each optional role, with what it costs and which side it joins. */
const ROLE_OPTS: Array<{
  key: keyof Opts; side: "good" | "evil"; good: number; evil: number;
  label: (rn: (id: string, f: string) => string) => string;
  desc: (rn: (id: string, f: string) => string) => string;
}> = [
  { key: "percival", side: "good", good: 1, evil: 0,
    label: (rn) => rn("percival", "Percival"),
    desc: (rn) => `Sees ${rn("merlin", "Merlin")} and ${rn("morgana", "Morgana")}, not which is which` },
  { key: "lovers", side: "good", good: 2, evil: 0,
    label: (rn) => `${rn("tristan", "Tristan")} & ${rn("isolde", "Isolde")}`,
    desc: () => "They know each other — two good seats" },
  { key: "lancelot", side: "good", good: 1, evil: 1,
    label: (rn) => `${rn("lancelot_good", "Lancelot")} / ${rn("lancelot_evil", "Lancelot")}`,
    desc: () => "One good, one evil; loyalties may switch" },
  { key: "guinevere", side: "good", good: 1, evil: 0,
    label: (rn) => rn("guinevere", "Guinevere"),
    desc: () => "Marks both Lancelots, never their sides" },
  { key: "morgana", side: "evil", good: 0, evil: 1,
    label: (rn) => rn("morgana", "Morgana"),
    desc: (rn) => `Appears as ${rn("merlin", "Merlin")}` },
  { key: "mordred", side: "evil", good: 0, evil: 1,
    label: (rn) => rn("mordred", "Mordred"),
    desc: (rn) => `Veiled from ${rn("merlin", "Merlin")}` },
  { key: "oberon", side: "evil", good: 0, evil: 1,
    label: (rn) => rn("oberon", "Oberon"),
    desc: () => "Knows no ally, and none knows them" },
];

export function LobbyScreen({
  room, pid, emblemSrc, account, worlds, act,
  onStart, onSwapSeat, onSetOpts, onChangeTheme, onLeave,
}: Pick<TableProps, "room" | "pid" | "emblemSrc" | "account" | "worlds" | "act"> & {
  onStart: () => Promise<unknown>;
  onSwapSeat: (watcherId: string, seatedId: string) => Promise<unknown>;
  onSetOpts: (opts: Opts) => Promise<unknown>;
  onChangeTheme: (themeId: string) => Promise<unknown>;
  onLeave: () => void;
}) {
  const [copied, setCopied] = useState(false);
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
      <div className="vd-setup__group">
        <span className="vd-label">The world</span>
        <div className="vd-worlds">
          {worlds.map((w) => {
            const on = w.id === room.themeId;
            const paid = !roomPremium && w.id !== "medieval" && !on;
            return (
              <button
                key={w.id}
                className={`vd-world ${on ? "is-on" : ""}`}
                disabled={!isHost || paid}
                title={paid ? `${w.name} — premium world` : w.name}
                onClick={act(() => onChangeTheme(w.id))}
              >
                <span className="vd-world__body">
                  <span className="vd-world__name">{w.name}</span>
                  <span className="vd-world__sub">
                    {paid ? "premium world" : `${w.goodTeamName} vs ${w.evilTeamName}`}
                  </span>
                </span>
                {on && <Check size={13} color="var(--vd-brass)" />}
                {paid && <Lock size={12} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="vd-setup__group">
        <div className="vd-row" style={{ justifyContent: "space-between" }}>
          <span className="vd-label">Roles in play</span>
          <span className="vd-label vd-label--dim">
            {goodUsed}/{goodSlots} good · {evilUsed}/{evilSlots} evil
          </span>
        </div>
        <div className="vd-opts">
          {ROLE_OPTS.map((o) => {
            const on = opts[o.key] === true;
            const lock = locked(o.key);
            const full = !on && !fits(o);
            return (
              <button
                key={o.key}
                className={`vd-opt vd-opt--${o.side} ${on ? "is-on" : ""}`}
                disabled={!isHost || lock || full}
                title={lock ? "Premium — upgrade to unlock" : full ? "No seat left on that side" : o.desc(rn)}
                onClick={act(() => toggle(o.key))}
              >
                <span className="vd-opt__top">
                  {o.side === "good"
                    ? <Sun size={12} color="var(--vd-brass)" />
                    : <Flame size={12} color="var(--vd-red-ink)" />}
                  <span className="vd-opt__name">{o.label(rn)}</span>
                  {lock ? <span className="vd-opt__lock"><Lock size={10} /> paid</span>
                    : on ? <Check size={13} color="var(--vd-brass)" /> : null}
                </span>
                <span className="vd-opt__desc">{o.desc(rn)}</span>
              </button>
            );
          })}
        </div>
        <p className="vd-voice vd-setup__note">
          {rn("merlin", "Merlin")} and {rn("assassin", "the Assassin")} always take the field.
        </p>
      </div>

      <div className="vd-setup__group">
        <span className="vd-label">Expansions</span>
        <div className="vd-opts">
          {([
            ["lady", room.theme.expansions?.lady?.name ?? "Lady of the Lake",
             seated < 7 ? "Needs seven at the table" : "Inspect one loyalty after quests 2–4"],
            ["excalibur", room.theme.expansions?.excalibur?.name ?? "Excalibur",
             "The leader arms a rider to flip a card"],
            ["plots", room.theme.expansions?.plots?.name ?? "Plot cards",
             `${seated <= 6 ? 1 : seated <= 8 ? 2 : 3} dealt each round by the leader`],
          ] as const).map(([key, name, desc]) => {
            const k = key as keyof Opts;
            const on = opts[k] === true;
            const lock = locked(k);
            const tooSmall = key === "lady" && seated < 7 && !on;
            return (
              <button
                key={key}
                className={`vd-opt ${on ? "is-on" : ""}`}
                disabled={!isHost || lock || tooSmall}
                title={lock ? "Premium — upgrade to unlock" : desc}
                onClick={act(() => toggle(k))}
              >
                <span className="vd-opt__top">
                  <Sparkles size={12} color="var(--vd-brass)" />
                  <span className="vd-opt__name">{name}</span>
                  {lock ? <span className="vd-opt__lock"><Lock size={10} /> paid</span>
                    : on ? <Check size={13} color="var(--vd-brass)" /> : null}
                </span>
                <span className="vd-opt__desc">{desc}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );

  return (
    <>
    <div className="vd-table vd-table-layout">
      {/* ------------------------------- left ------------------------------ */}
      <div className="vd-stack">
        <div className="vd-studded vd-panel vd-panel--strong">
          <span className="vd-stud-b" aria-hidden />
          <div className="vd-label vd-label--dim">At the table</div>
          <div className="vd-numeral" style={{ fontSize: 44, marginTop: 6 }}>{seated}</div>
          <div className="vd-label" style={{ marginTop: 8 }}>of {room.seating.cap} seats</div>
        </div>

        <div className="vd-invite">
          <div>
            <div className="vd-label vd-label--dim">Council code</div>
            <div className="vd-invite__code">{room.code}</div>
          </div>
          <button className="vd-invite__btn" onClick={() => void copyInvite()}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "copied" : "copy link"}
          </button>
        </div>

        <div className="vd-stack vd-stack--tight">
          <span className="vd-label">The company</span>
          {room.players.map((p) => (
            <div key={p.playerId} className="vd-tile">
              <span className="vd-tile__seat">{p.seat + 1}</span>
              {p.name}
              <span className="vd-tile__meta">
                {p.isHost ? "host" : ""}{p.isHost && p.playerId === pid ? " · " : ""}
                {p.playerId === pid ? "you" : ""}
              </span>
            </div>
          ))}
        </div>

        <p className="vd-voice">
          Five to ten play. Anyone beyond the seats watches the board and waits
          for one to empty.
        </p>

        <button className="vd-textbtn" onClick={onLeave}>
          <LogOut size={11} /> Leave council
        </button>
      </div>

      {/* ------------------------------ centre ----------------------------- */}
      <div className="vd-centre">
        <SeatRing
          room={room}
          emblemSrc={emblemSrc}
          stateFor={(p) => (p.playerId === pid ? "leader" : "idle")}
          noteFor={(p) =>
            p.isHost ? (p.playerId === pid ? "Host · you" : "Host")
              : p.playerId === pid ? "You" : ROMAN[p.seat] ?? String(p.seat + 1)
          }
        />

        <div className="vd-centre__wide vd-actionbar">
          {stranded.length > 0 && (
            <div className="vd-panel vd-panel--danger" style={{ marginBottom: 12 }}>
              <p className="vd-voice" style={{ margin: 0, color: "var(--vd-red-ink)" }}>
                {stranded.map((k) => PREMIUM_OPT_LABELS[k] ?? k).join(", ")}{" "}
                {stranded.length === 1 ? "is" : "are"} premium and this room has no
                active plan. Switch {stranded.length === 1 ? "it" : "them"} off, or upgrade.
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
                label="Cast the lots"
                value={seated < 5 ? `${5 - seated} MORE NEEDED` : undefined}
              />
              <button className="vd-btn vd-btn--primary" disabled={!canStart} onClick={act(onStart)}>
                <span>
                  {seated < 5
                    ? "Not enough at the table"
                    : errors.length > 0 || stranded.length > 0
                      ? "Fix the roster to begin"
                      : "Cast the lots & begin"}
                </span>
                <Swords size={16} />
              </button>
            </>
          ) : (
            <div className="vd-panel">
              <p className="vd-voice" style={{ margin: 0 }}>
                {room.seating.iAmWatching
                  ? "You are in the queue. A seat will come to you when one empties."
                  : "You have a seat. Waiting on the host to cast the lots."}
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
            <span className="vd-label"><Users size={11} /> Watching</span>
            <span className="vd-label vd-label--brass">{room.seating.watcherCount}</span>
          </div>

          {room.watchers.length === 0 ? (
            <p className="vd-voice" style={{ margin: 0 }}>
              Nobody is waiting. Every seat that matters is filled.
            </p>
          ) : (
            <>
              <div className="vd-watchers">
                {room.watchers.map((w, i) => (
                  <div key={w.playerId} className="vd-watcher">
                    <span className="vd-watcher__q">{i + 1}</span>
                    {w.name}
                    {w.playerId === pid && <span className="vd-tile__meta">you</span>}
                    {isHost && (
                      <button
                        className="vd-watcher__seat"
                        title="Seat this watcher in place of the last seated player"
                        onClick={act(() =>
                          onSwapSeat(w.playerId, room.players[room.players.length - 1].playerId),
                        )}
                      >
                        Seat
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="vd-voice" style={{ margin: 0 }}>
                Watchers hear the room and see the board, and are never dealt a
                role. To seat everyone, split the room and run a second table.
              </p>
            </>
          )}
        </div>

        {!roomPremium && isHost && (
          <a className="vd-btn" href="#/upgrade" style={{ textDecoration: "none" }}>
            <span>Unlock the premium roles &amp; worlds</span>
            <Crown size={15} />
          </a>
        )}

        <ChronicleColumn room={room} />
      </div>
    </div>

    {setup}
    </>
  );
}
