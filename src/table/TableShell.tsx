/* ============================================================================
   The board every phase sits on.

   What this used to be: a topbar carrying the wordmark, the world's name, the
   room code, a plan badge, a rules link, an admin link and a sign-in button; a
   two-line status banner; and a row of five controls, three of which end the
   game. Then, per screen, a 288px column of rules and a 274px column of
   ledger. On a phone that is about 1,100px of reading before the button you
   came to press.

   What it is now: one bar, one line of instruction, and the screen. Everything
   that was explanation rather than instruction moved into the ⓘ sheet
   (`GameInfo`); everything that was a rarely-used control moved into the ⋯
   menu. Two things stayed in reach on purpose — the room code, which people
   are always being asked to read out, and your own role, which people forget.
   ========================================================================== */

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  BadgeCheck, Crown, Hourglass, Info, LogIn, LogOut, MoreHorizontal, RotateCcw,
  ScrollText, Shield, Sparkles, XCircle,
} from "lucide-react";
import { DISCUSS_MS, SELECT_MS } from "../../convex/logic";
import { GameInfo } from "./GameInfo";
import type { Account, Room } from "./types";
import { displayName, leaderOf, partySize } from "./types";
import { RoleReveal } from "./RoleReveal";
import { SoundToggle } from "../SoundToggle";

/** Phases that are a turn of the game rather than setup, dealing or results. */
const IN_PLAY = new Set([
  "propose", "plot", "vote", "kingReturns", "quest", "excalibur", "lady", "assassin",
]);

export function TableShell({
  room, pid, theme, emblemSrc, account, error,
  onRestart, onClose, onStartFresh, onLeave, children,
}: {
  room: Room;
  pid: string;
  theme: { name: string; goodTeamName: string; evilTeamName: string };
  emblemSrc: string;
  account: Account;
  error?: string;
  onRestart: () => Promise<unknown>;
  onClose: () => Promise<unknown>;
  onStartFresh: () => Promise<unknown>;
  onLeave: () => void;
  children: ReactNode;
}) {
  const [info, setInfo] = useState(false);
  const isHost = room.hostId === pid;
  const inPlay = IN_PLAY.has(room.phase);

  return (
    <div className="vd-board">
      <div className={`vd-content vd-shell ${inPlay ? "is-play" : ""}`}>
        <header className="vd-bar">
          <div className="vd-bar__left">
            <img src={emblemSrc} alt="" width={22} height={22} className="vd-bar__emblem" />
            {/* The one thing on this bar people read out loud. */}
            <span className="vd-bar__code" title="The code people join with">
              {room.code}
            </span>
            {inPlay && room.questIndex >= 0 && (
              <span className="vd-bar__where">
                {/* "Mission" is the first thing to go when the bar has to hold
                    a code, a clock and three controls in 375px: the strip
                    below highlights the same number, so "3 of 5" is enough. */}
                <span className="vd-bar__whereword">Mission </span>
                {room.questIndex + 1} of 5
              </span>
            )}
            <ClockReadout room={room} />
          </div>

          <div className="vd-bar__right">
            {room.seating.iAmWatching && (
              <span className="vd-label vd-label--dim">Watching</span>
            )}
            {room.phase !== "lobby" && room.phase !== "reveal" && (
              <RoleReveal room={room} theme={theme} />
            )}
            <SoundToggle />
            {room.phase !== "lobby" && (
              <button
                className="vd-iconbtn"
                onClick={() => setInfo(true)}
                aria-label="This game, and what's happened so far"
                title="This game, and what's happened so far"
              >
                <Info size={16} />
              </button>
            )}
            <OverflowMenu
              room={room}
              account={account}
              isHost={isHost}
              onRestart={onRestart}
              onClose={onClose}
              onStartFresh={onStartFresh}
              onLeave={onLeave}
            />
          </div>

          <ClockFuseLine room={room} />
        </header>

        <ClockAlert room={room} />
        <PhaseBanner room={room} pid={pid} />

        {error && <div className="vd-panel vd-panel--danger vd-errline">{error}</div>}

        {children}
      </div>

      {info && (
        <GameInfo room={room} theme={theme} onClose={() => setInfo(false)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ bar --- */

/**
 * Everything that is reachable but not part of this turn.
 *
 * These were five controls sitting permanently under the status line, three of
 * which end the game for everyone. They keep the same two-tap `Confirm` they
 * always had; what changed is that your thumb no longer passes over them on
 * the way to voting.
 */
function OverflowMenu({
  room, account, isHost, onRestart, onClose, onStartFresh, onLeave,
}: {
  room: Room;
  account: Account;
  isHost: boolean;
  onRestart: () => Promise<unknown>;
  onClose: () => Promise<unknown>;
  onStartFresh: () => Promise<unknown>;
  onLeave: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="vd-menu" ref={wrap}>
      <button
        className="vd-iconbtn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More"
        onClick={() => setOpen((o) => !o)}
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div className="vd-menu__panel" role="menu">
          <a className="vd-menu__item" href="/rules" role="menuitem">
            <ScrollText size={14} /> How to play
          </a>

          {account.premium ? (
            <span className="vd-menu__item is-static">
              <BadgeCheck size={14} /> Paid plan active
            </span>
          ) : account.signedIn ? (
            <a className="vd-menu__item" href="/upgrade" role="menuitem">
              <Crown size={14} /> See the paid plan
            </a>
          ) : (
            <button className="vd-menu__item" role="menuitem" onClick={account.signIn}>
              <LogIn size={14} /> Sign in
            </button>
          )}
          {account.isAdmin && (
            <a className="vd-menu__item" href="/admin" role="menuitem">
              <Shield size={14} /> Admin
            </a>
          )}

          <span className="vd-menu__sep" role="separator" />

          {isHost && room.phase !== "lobby" && (
            <Confirm
              className="vd-menu__item"
              label="Start over"
              icon={<RotateCcw size={14} />}
              ask="Send everyone back to setup and re-deal the roles? Same people, same code."
              onConfirm={onRestart}
            />
          )}
          {isHost && (
            <Confirm
              className="vd-menu__item"
              label="New game, new code"
              icon={<Sparkles size={14} />}
              ask="End this game and open a new one under a different code? Everyone joins again."
              onConfirm={onStartFresh}
            />
          )}
          {isHost && (
            <Confirm
              className="vd-menu__item"
              label="End for everyone"
              icon={<XCircle size={14} />}
              ask="End this game for everyone? This cannot be undone."
              onConfirm={onClose}
              danger
            />
          )}
          <Confirm
            className="vd-menu__item"
            label="Leave"
            icon={<LogOut size={14} />}
            ask={
              room.phase === "lobby"
                ? "Leave this game?"
                : "Leave? Your place is saved — join again with the same name."
            }
            onConfirm={async () => onLeave()}
          />
        </div>
      )}
    </div>
  );
}

/** The propose clock, as a number in the bar rather than a 52px display. */
function ClockReadout({ room }: { room: Room }) {
  const endsAt = clockEnd(room);
  const now = useTick(endsAt !== null);
  if (endsAt === null) return null;
  const left = Math.max(0, endsAt - now);
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);
  return (
    <span className="vd-bar__clock" role="timer" aria-live="off">
      {mm}:{String(ss).padStart(2, "0")}
    </span>
  );
}

/**
 * The same clock as a hairline along the bottom of the bar. It replaces a row
 * of fifteen ticks with one rule, which is the same information at a tenth of
 * the ink — and it re-renders once a second, so it steps rather than animates.
 */
function ClockFuseLine({ room }: { room: Room }) {
  const endsAt = clockEnd(room);
  const now = useTick(endsAt !== null);
  if (endsAt === null) return null;
  const left = Math.max(0, endsAt - now);
  const pct = Math.max(0, Math.min(100, (left / (DISCUSS_MS + SELECT_MS)) * 100));
  return (
    <span className="vd-bar__fuse" aria-hidden>
      <i style={{ width: `${pct}%` }} />
    </span>
  );
}

function clockEnd(room: Room): number | null {
  if (room.phase !== "propose" && room.phase !== "plot") return null;
  return room.selectEndsAt ?? room.discussEndsAt ?? null;
}

/** One re-render a second, and only while something is counting down. */
function useTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/* --------------------------------------------------------------- pieces --- */

/**
 * The one line above the primary action. Kept for the few places where it is
 * the ONLY statement of something — not, as before, a restatement of the
 * banner above it and the button below it.
 */
export function ActionLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="vd-actionline">
      <span className="vd-label">{label}</span>
      {value && <span className="vd-label vd-label--brass">{value}</span>}
    </div>
  );
}

/** What the app is waiting for, when it is not waiting for you. */
export function Waiting({ children }: { children: ReactNode }) {
  return (
    <p className="vd-waiting">
      <Hourglass size={15} />
      <span>{children}</span>
    </p>
  );
}

/** Corner-studded container. Reserved for objects with rank. */
export function Studded({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`vd-studded ${className ?? ""}`}>
      {children}
      <span className="vd-stud-b" />
    </div>
  );
}

/**
 * What the table is waiting for — in ONE line.
 *
 * Every phase used to state its instruction and then, underneath, the rule
 * behind it: "Everyone votes, not just the people on the team", "Nobody sees
 * any vote until the last one lands", and eleven more. Thirteen sentences of
 * tutorial, on the screen a player is trying to act on, in a game whose whole
 * How-to-play page already says all of it. The instruction stayed; the lesson
 * went to /learn.
 */
function PhaseBanner({ room, pid }: { room: Room; pid: string }) {
  const leader = leaderOf(room);
  const mine = leader?.playerId === pid;
  const who = mine ? "You" : leader ? displayName(leader.name) : "the leader";
  const riders = partySize(room);
  const watching = room.seating.iAmWatching;
  const isHost = room.hostId === pid;
  const seated = room.seating.seatedCount;
  const away = (room.seating.awayNames ?? []).map(displayName);

  let text: string;
  let urgent = false;

  const onTeam = room.proposedTeam.includes(pid);
  const left = (a: number, b: number) => a - b;

  switch (room.phase) {
    case "lobby":
      if (watching) {
        text = "You're next in line for a place.";
      } else if (isHost) {
        text = seated < 5
          ? `${seated} here — ${5 - seated} more to start.`
          : `${seated} in. Start when you're ready.`;
        urgent = seated >= 5;
      } else {
        text = `${seated} in. Waiting for the host.`;
      }
      break;
    case "reveal":
      text = watching ? "You're watching this round." : "Hold your card to see your role.";
      urgent = !watching;
      break;
    case "plot":
    case "propose":
      text = mine
        ? `Choose ${riders} people for this mission.`
        : `${who} is choosing ${riders} people.`;
      urgent = mine;
      break;
    case "vote":
      if (watching) {
        text = `Voting — ${room.voteProgress.voted} of ${room.voteProgress.total} in.`;
      } else if (room.voteProgress.iVoted) {
        text = `Vote in. Waiting for ${left(room.voteProgress.total, room.voteProgress.voted)} more.`;
      } else {
        text = "Vote yes or no on this team.";
        urgent = true;
      }
      break;
    case "kingReturns":
      text = "A plot card can still cancel this team.";
      break;
    case "quest":
      if (onTeam && !room.questProgress.iSubmitted) {
        text = "Play your card.";
        urgent = true;
      } else {
        text = `Cards coming in — ${room.questProgress.submitted} of ${room.questProgress.total}.`;
      }
      break;
    case "excalibur":
      text = "All cards in. One can still be flipped.";
      break;
    case "lady":
      text = "One player is learning somebody's true side.";
      break;
    case "assassin":
      text = "Three missions succeeded. One last guess.";
      urgent = true;
      break;
    /* No banner on the reckoning: the winner is already the largest thing on
       that screen, and "Game over" under it said nothing it did not. */
    default:
      text = "";
  }

  const skipped = room.lastSkip && room.phase === "propose";
  if (!text && !skipped && away.length === 0) return null;

  return (
    <>
      {text && (
        <div className={`vd-banner ${urgent ? "is-urgent" : ""}`} role="status">
          <span className="vd-banner__mark" aria-hidden />
          <span className="vd-banner__text">{text}</span>
        </div>
      )}

      {skipped && (
        <div className="vd-banner vd-banner--away" role="status">
          <span className="vd-banner__mark" aria-hidden />
          <span className="vd-banner__text">
            {displayName(room.lastSkip!.name)} ran out of time, so someone else
            picks for this mission.
          </span>
        </div>
      )}

      {/* A seat cannot be removed mid-game without resizing the table, so an
          empty one is announced instead: the table knows why it is waiting. */}
      {away.length > 0 && room.phase !== "lobby" && (
        <div className="vd-banner vd-banner--away" role="status">
          <span className="vd-banner__mark" aria-hidden />
          <span className="vd-banner__text">
            {away.join(", ")} left — {away.length === 1 ? "their place is" : "their places are"} saved.
          </span>
        </div>
      )}
    </>
  );
}

/** A destructive action that asks once. Two taps, no browser dialog. */
export function Confirm({
  label, icon, ask, onConfirm, danger, compact, ariaLabel, className, disabled,
}: {
  label: string;
  icon: ReactNode;
  ask: string;
  onConfirm: () => Promise<unknown>;
  danger?: boolean;
  /** Icon-only trigger (e.g. a roster row's remove control) instead of the text-button row. */
  compact?: boolean;
  ariaLabel?: string;
  className?: string;
  /** Disables the trigger only — once asking, Yes/No always stay enabled. */
  disabled?: boolean;
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button
        className={className ?? "vd-textbtn"}
        aria-label={ariaLabel}
        title={ariaLabel}
        disabled={disabled}
        onClick={() => setAsking(true)}
      >
        {icon}
        {!compact && label}
      </button>
    );
  }

  /* "Yes" / "No" told you nothing about which one you were about to do, on
     controls that can end a game for eight people. The confirm button now
     repeats the action, and the way out says "Cancel". */
  return (
    <span className="vd-confirm">
      <span className="vd-confirm__ask">{ask}</span>
      <span className="vd-confirm__acts">
        <button
          className={`vd-confirm__yes ${danger ? "is-danger" : ""}`}
          onClick={() => {
            setAsking(false);
            void onConfirm();
          }}
        >
          {label}
        </button>
        <button className="vd-textbtn" onClick={() => setAsking(false)}>
          Cancel
        </button>
      </span>
    </span>
  );
}

/**
 * The four minutes running out is the single most missable moment in the game:
 * the clock keeps counting, the screen does not change, and the table carries
 * on arguing while the leader's minute drains. This is the thing that says so,
 * to everybody, once.
 *
 * Entirely client-side — the deadline is already on the room, so no round trip
 * and no new state. It fires on the CROSSING, not on the value, so a tab that
 * opens late does not announce a moment it missed.
 */
function ClockAlert({ room }: { room: Room }) {
  const [alert, setAlert] = useState<string | null>(null);
  const seen = useRef<string>("");

  useEffect(() => {
    if (room.phase !== "propose" || !room.discussEndsAt) return;
    const key = `${room.roundId}:${room.discussEndsAt}`;
    if (seen.current === key) return;
    const leftMs = room.discussEndsAt - Date.now();
    if (leftMs <= 0) { seen.current = key; return; }

    const t = setTimeout(() => {
      seen.current = key;
      setAlert("Talking time is up — one minute to pick a team.");
    }, leftMs);
    return () => clearTimeout(t);
  }, [room.phase, room.roundId, room.discussEndsAt]);

  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 7000);
    return () => clearTimeout(t);
  }, [alert]);

  if (!alert) return null;
  return (
    <div className="vd-alert" role="alert">
      <span className="vd-alert__mark" aria-hidden />
      <span className="vd-alert__text">{alert}</span>
      <button className="vd-textbtn" onClick={() => setAlert(null)}>Dismiss</button>
    </div>
  );
}
