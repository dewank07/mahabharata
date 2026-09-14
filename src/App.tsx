import { useState, useEffect, useRef } from "react";
import type * as React from "react";
import { useQuery, useMutation } from "convex/react";

import { api } from "../convex/_generated/api";
import { RevealCeremony } from "./RevealCeremony";
import { Table, type TableActions } from "./table";
import { displayName } from "./table/types";
import emblemSrc from "./assets/mark.svg";
import { navigate } from "./router";
import { play } from "./sound";
import { THEMES, THEME_LIST } from "../convex/themes";
import { isPremiumTheme } from "../convex/logic";
import {
  BadgeCheck,
  Check,
  Crown,
  LogIn,
  ScrollText,
  Sword,
  X,
  ArrowRight,
  Loader2,
  User,
  Key,
  Timer,
  Lock,
  Shield,
  BookOpen,
} from "lucide-react";

/* ============================ identity (per tab) ========================= */
// sessionStorage so each browser tab/window is a distinct warrior.
// Refresh in the same tab keeps the seat; a new incognito window gets a new id.
const PID_KEY = "decevia.pid";
function loadPid(): string {
  let id = sessionStorage.getItem(PID_KEY);
  if (!id) {
    id =
      Math.random().toString(36).slice(2, 10) +
      Math.random().toString(36).slice(2, 6);
    sessionStorage.setItem(PID_KEY, id);
  }
  return id;
}

/* ============================= role display meta ========================== */
type Role =
  | "merlin"
  | "percival"
  | "guinevere"
  | "tristan"
  | "isolde"
  | "lancelot_good"
  | "servant"
  | "assassin"
  | "morgana"
  | "mordred"
  | "oberon"
  | "lancelot_evil"
  | "minion";

const PLOT_LABEL: Record<string, string> = {
  lead_to_victory: "Lead to Victory",
  ambush: "Ambush",
  king_returns: "King Returns",
  we_found_you: "We Found You",
  restore_honor: "Restore Your Honor",
  show_strength: "Show Your Strength",
  show_true_nature: "Show Your True Nature",
  are_you_the_one: "Are You the One?",
  charge: "Charge",
};

/* ================================ component =============================== */
export default function App() {
  const [pid, setPid] = useState(loadPid);
  const [name, setName] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [code, setCode] = useState<string | null>(() =>
    sessionStorage.getItem("decevia.code"),
  );
  const [msg, setMsg] = useState("");
  /** Set when a name is already seated: the seat we may take back over. */
  const [rejoinName, setRejoinName] = useState<string | null>(null);
  const [opts, setOpts] = useState({
    percival: true,
    morgana: true,
    mordred: false,
    oberon: false,
    guinevere: false,
    lovers: false,
    lancelot: false,
    lady: false,
    excalibur: false,
    plots: false,
  });
  const [localThemeId, setLocalThemeId] = useState<string>("medieval");
  const [activeTab, setActiveTab] = useState<"create" | "join">("create");
  const [copiedLink, setCopiedLink] = useState(false);

  // Prefill join from ?code=ABCD invite links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = (params.get("code") ?? "").trim().toUpperCase();
    if (invite.length === 4 && !sessionStorage.getItem("decevia.code")) {
      setCodeInput(invite);
      setActiveTab("join");
      return;
    }
    // The landing page's "Join the council" button has no code to prefill —
    // it links here with ?tab=join so the gate opens on the tab that click
    // actually meant, instead of defaulting to Convene.
    if (params.get("tab") === "join" && !sessionStorage.getItem("decevia.code")) {
      setActiveTab("join");
    }
  }, []);

  // The room lives in the URL so a refresh — or a link sent to a friend — lands
  // back at the same table. Canonicalised to /play, so an invite opened at
  // /?code=ABCD does not leave the app sitting on the landing route.
  useEffect(() => {
    if (code) sessionStorage.setItem("decevia.code", code);
    else sessionStorage.removeItem("decevia.code");
    const url = new URL(window.location.href);
    url.pathname = "/play";
    if (code) url.searchParams.set("code", code);
    else url.searchParams.delete("code");
    navigate(url.pathname + url.search, { replace: true });
  }, [code]);

  const room = useQuery(
    api.avalon.getRoom,
    code ? { code, playerId: pid } : "skip",
  );

  /**
   * Turned out of the room. Two shapes, because mid-game a seat cannot be
   * deleted without resizing the table: in the lobby our row is gone, and
   * mid-game it is still there but flagged away. Either way we land back at
   * the gate with the code filled in — being removed here is not a ban, and
   * walking straight back in is the point.
   */
  const myRow = room?.players.find((p) => p.playerId === pid) ?? null;
  const benched = myRow?.away === true;
  const evicted = room != null && room.me == null;

  useEffect(() => {
    if (!code || !room || (!evicted && !benched)) return;
    setCodeInput(code);
    setActiveTab("join");
    setCode(null);
    setMsg(
      benched
        ? "You were taken out of the game. Your place is saved — join again with the same name to get it back."
        : "The host removed you from the game. You can join again any time.",
    );
  }, [code, evicted, benched]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (room?.opts) setOpts({ ...opts, ...room.opts });
  }, [room?.opts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Role names/lore always come from the room's themeId via the local THEMES
  // map — never from a joiner's default "india" selection on the home screen.
  const activeTheme =
    (room?.themeId && THEMES[room.themeId]) ||
    (room?.theme?.id && THEMES[room.theme.id]) ||
    THEMES[localThemeId] ||
    THEMES.india;

  useEffect(() => {
    if (room?.themeId && room.themeId !== localThemeId) {
      setLocalThemeId(room.themeId);
    }
  }, [room?.themeId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* The board PALETTE is fixed — nothing per-theme is injected any more — but
     the realm is no longer inert either: `chamber.css` reads this attribute to
     decide which illustrated ground the gate, the lobby and the table stand on
     (the medieval hall, the Kurukshetra relief, or none). Change what this is
     set to and the room behind the game changes with it. */
  useEffect(() => {
    document.documentElement.dataset.realm = activeTheme.id;
    return () => { delete document.documentElement.dataset.realm; };
  }, [activeTheme]);

  /* The ground under the whole app, one per phase — the system's four
     surfaces. It is set on the ROOT rather than on the board so every overlay
     that escapes the board (the reveal, the info sheet, the explainer) stands
     on the same cloth as the screen behind it.

     The reckoning takes the rust ground whichever side won: it is the colour
     of the game being over, not of losing. */
  const phaseGround =
    room == null || room.phase === "lobby"
      ? "room"
      : room.phase === "reveal"
        ? "night"
        : room.phase === "end"
          ? "loss"
          : "table";

  useEffect(() => {
    document.documentElement.dataset.phase = phaseGround;
    return () => { delete document.documentElement.dataset.phase; };
  }, [phaseGround]);

  /* The table moving on is the one thing that happens to you rather than
     because of you — somebody else voted, somebody else sealed a quest — and
     it is what a player looking away misses. One cue on the CROSSING, never
     on the value: `seen` starts at whatever phase this tab first rendered, so
     joining a game in progress is silent, and a re-render that does not change
     the phase is too. There is no cue for the phase's CONTENT, so this says
     "look up" and nothing more. */
  const seenPhase = useRef<string | null>(null);
  useEffect(() => {
    const phase = room?.phase ?? null;
    if (phase === null) { seenPhase.current = null; return; }
    if (seenPhase.current === null) { seenPhase.current = phase; return; }
    if (seenPhase.current === phase) return;
    seenPhase.current = phase;
    play("phase");
  }, [room?.phase]);

  // Account + entitlement. Signing in is optional to play; it is what unlocks
  // the paid roles and boards, and what the admin console checks.
  const viewer = useQuery(api.billing.viewer, {});
  const premium = viewer?.premium === true;
  const signedIn = viewer?.signedIn === true;

  const mCreate = useMutation(api.avalon.createRoom);
  const mJoin = useMutation(api.avalon.joinRoom);
  const mLeave = useMutation(api.avalon.leaveRoom);
  const mSetOpts = useMutation(api.avalon.setOpts);
  const mChangeTheme = useMutation(api.avalon.changeTheme);
  const mStart = useMutation(api.avalon.startGame);
  const mBegin = useMutation(api.avalon.beginQuests);
  const mPropose = useMutation(api.avalon.proposeTeam);
  const mVote = useMutation(api.avalon.castVote);
  const mCard = useMutation(api.avalon.playQuestCard);
  const mAssassinate = useMutation(api.avalon.assassinate);
  const mNewGame = useMutation(api.avalon.newGame);
  const mExcalibur = useMutation(api.avalon.useExcalibur);
  const mLady = useMutation(api.avalon.useLady);
  const mDealPlot = useMutation(api.avalon.dealPlotCard);
  const mPlayPlot = useMutation(api.avalon.playPlotCard);
  const mPassKing = useMutation(api.avalon.passKingReturns);
  const mDiscardPlot = useMutation(api.avalon.discardPlotCard);
  const mSealQuest = useMutation(api.avalon.sealQuest);
  const mSwapSeat = useMutation(api.avalon.swapSeat);
  const mCloseRoom = useMutation(api.avalon.closeRoom);
  const mStartFresh = useMutation(api.avalon.startFreshRoom);
  const mRemovePlayer = useMutation(api.avalon.removePlayer);

  const wrap = (fn: () => Promise<unknown>) => async () => {
    try {
      setMsg("");
      await fn();
    } catch (e: any) {
      setMsg(e?.message ?? "Something went wrong.");
    }
  };

  async function createRoom() {
    if (!name.trim()) return setMsg("Type your name first, so everyone can see who you are.");
    const r = await mCreate({
      playerId: pid,
      name,
      themeId: localThemeId,
      opts,
    });
    setCode(r.code);
    setMsg("");
  }
  /**
   * `rejoin` is the second half of a two-step. The first attempt reports a name
   * already seated rather than taking it, because taking a seat means taking
   * its role — the server will only hand it over when asked outright.
   */
  async function joinRoom(rejoin = false) {
    if (!name.trim()) return setMsg("Type your name first, so everyone can see who you are.");
    const c = codeInput.trim().toUpperCase();
    if (c.length !== 4) return setMsg("A game code is 4 letters — check it with whoever set the game up.");
    const r = await mJoin({ code: c, playerId: pid, name, rejoin });
    if (r.status === "nameTaken") {
      setRejoinName(name.trim());
      setMsg("");
      return;
    }
    // A reclaimed seat comes back with the id it was left under; adopting it
    // reunites this tab with its role, its votes and its quest card.
    if (r.playerId && r.playerId !== pid) {
      sessionStorage.setItem(PID_KEY, r.playerId);
      setPid(r.playerId);
    }
    setRejoinName(null);
    setCode(r.code);
    setMsg("");
  }
  function leaveRoom() {
    if (code) mLeave({ code, playerId: pid }).catch(() => {});
    setCode(null);
    setMsg("");
  }

  const me = room?.me ?? null;
  const myRole = (me?.role ?? null) as Role | null;
  const isHost = room?.hostId === pid;
  const players = room?.players ?? [];
  const leader = room ? players[room.leaderIndex] : null;
  const isLeader = leader?.playerId === pid;
  const n = players.length;

  /**
   * Everything the Council Seal table can do. Kept here so the screens stay
   * presentational and every mutation error surfaces through one path.
   */
  const tableActions: TableActions = {
    start: () => mStart({ code: code!, playerId: pid }),
    setOpts: (next) => mSetOpts({ code: code!, playerId: pid, opts: next }),
    changeTheme: (themeId) => mChangeTheme({ code: code!, playerId: pid, themeId }),
    leave: leaveRoom,
    swapSeat: (watcherId, seatedId) =>
      mSwapSeat({ code: code!, playerId: pid, watcherId, seatedId }),
    removePlayer: (targetId) =>
      mRemovePlayer({ code: code!, playerId: pid, targetId }),
    begin: () => mBegin({ code: code!, playerId: pid }),
    propose: (team, excaliburId) =>
      mPropose({ code: code!, playerId: pid, team, excaliburId }),
    vote: (choice) => mVote({ code: code!, playerId: pid, choice }),
    card: (card) => mCard({ code: code!, playerId: pid, card }),
    useExcalibur: (targetId) =>
      mExcalibur({ code: code!, playerId: pid, targetId }),
    sealQuest: () => mSealQuest({ code: code!, playerId: pid }),
    useLady: (targetId) => mLady({ code: code!, playerId: pid, targetId }),
    strike: (mode, targetId, targetId2) =>
      mAssassinate({ code: code!, playerId: pid, mode, targetId, targetId2 }),
    newGame: () => mNewGame({ code: code!, playerId: pid }),
    // Same mutation as "another game" at the reckoning: it returns the room to
    // the lobby with every role, vote and card cleared. From mid-game it is a
    // restart, which is what a table that mis-set the roles actually needs.
    restart: () => mNewGame({ code: code!, playerId: pid }),
    close: async () => {
      await mCloseRoom({ code: code!, playerId: pid });
      setCode(null);
    },
    // The old room is gone by the time this resolves, so switching `code` to
    // the new one is what keeps the host from watching their own query go null.
    startFresh: async () => {
      const r = await mStartFresh({ code: code!, playerId: pid });
      setCode(r.code);
    },
    dealPlot: (toId) => mDealPlot({ code: code!, playerId: pid, toId }),
    playPlot: (card, targetId) =>
      mPlayPlot({ code: code!, playerId: pid, card: card as any, targetId }),
    discardPlot: (card) => mDiscardPlot({ code: code!, playerId: pid, card }),
    playKingReturns: () =>
      mPlayPlot({ code: code!, playerId: pid, card: "king_returns" }),
    passKingReturns: () => mPassKing({ code: code!, playerId: pid }),
  };

  /**
   * `act` for the table: same error funnel as `wrap`, but takes a thunk.
   *
   * It is also where the `seal` cue lives, and the reason there is exactly one
   * line of audio in the whole table rather than a call in each of fourteen
   * screens: everything a player COMMITS — a vote, a quest card, a target, a
   * plot — already comes through here, so one cue covers all of them and a new
   * screen gets it for free. Fired before the await, because the cue is
   * feedback that the press landed, not that the server agreed; the failure
   * path is the error line, which is a better carrier for that than silence.
   */
  const act = (fn: () => Promise<unknown>) => async () => {
    play("seal", true);
    try {
      setMsg("");
      await fn();
    } catch (e: any) {
      setMsg(e?.message ?? "Something went wrong.");
    }
  };

  /* =============================== render =============================== */
  return (
    <>
      {!code && Home()}
      {code && room === undefined && (
        <div className="vd-board">
          <div className="vd-content vd-center">
            <p className="vd-loading" role="status">
              <Loader2 size={26} className="vd-spin" color="var(--vd-brass)" />
              <span>Joining game {code}…</span>
              <span className="vd-hint">
                If this doesn't finish, check the code and your connection.
              </span>
            </p>
          </div>
        </div>
      )}
      {code && room === null && (
        <CodeGone code={code} onBack={() => { setCode(null); setMsg(""); }} />
      )}

      {/* The Council Seal owns every in-game phase. */}
      {code && room && (
        <Table
          room={room}
          pid={pid}
          theme={{
            name: activeTheme.name,
            goodTeamName: activeTheme.goodTeamName,
            evilTeamName: activeTheme.evilTeamName,
          }}
          emblemSrc={emblemSrc}
          account={{
            signedIn: signedIn,
            isAdmin: viewer?.isAdmin === true,
            premium: premium,
            email: viewer?.email ?? null,
            signIn: () => { navigate("/signin"); },
          }}
          worlds={THEME_LIST.map((t) => ({
            id: t.id,
            name: t.name,
            goodTeamName: t.goodTeamName,
            evilTeamName: t.evilTeamName,
          }))}
          act={act}
          error={msg}
          actions={tableActions}
        />
      )}

      {code && room && (room.lastVote || room.lastQuest) && (
        <RevealCeremony
          code={code}
          lastVote={
            room.lastVote
              ? {
                  ...room.lastVote,
                  // Votes are public in Avalon — the table is entitled to know
                  // who turned the party away, not just how many did.
                  approverNames: room.lastVote.approvers.map((id) =>
                    displayName(players.find((p) => p.playerId === id)?.name ?? "someone"),
                  ),
                  rejecterNames: room.lastVote.rejecters.map((id) =>
                    displayName(players.find((p) => p.playerId === id)?.name ?? "someone"),
                  ),
                  overturnedBy: room.lastVote.overturnedBy
                    ? displayName(players.find(
                        (p) => p.playerId === room.lastVote!.overturnedBy,
                      )?.name ?? "someone")
                    : null,
                }
              : null
          }
          lastQuest={
            room.lastQuest
              ? {
                  ...room.lastQuest,
                  revealed: (room.lastQuest.revealed ?? []).map((r) => ({
                    name: displayName(
                      players.find((p) => p.playerId === r.playerId)?.name ??
                        "someone",
                    ),
                    card: r.card,
                  })),
                }
              : null
          }
        />
      )}
    </>
  );


  /* ------------------------------- screens ------------------------------ */
  /** The gate. Same board language as the table: flat, brass, parchment. */
  function Home() {
    const gateSubmit = wrap(activeTab === "create" ? createRoom : () => joinRoom());
    return (
      <div className="vd-board">
        <div className="vd-content vd-gate">
          <header className="vd-gate__head">
            <img src={emblemSrc} alt="" width={30} height={30} className="vd-topbar__emblem" />
            <h1 className="vd-gate__brand">DECEVIA</h1>
            <p className="vd-label vd-gate__promise">Where friends become foes</p>
            {/* An arrival straight off an invite link never sees the front
                page, so this is the only place they can be told what the
                thing is. It used to be the setting's tagline, which assumes
                you already know. */}
            {/* Three short sentences beat one long one here — and the bold
                clause is kept short enough that it never breaks across a line,
                which the longer version did on every phone. */}
            <p className="vd-voice vd-gate__tag">
              5 to 18 players. Most are on your side.{" "}
              <strong>A few are lying.</strong>
            </p>
          </header>

          <div className="vd-studded vd-gate__card">
            <span className="vd-stud-b" aria-hidden />

            {/* "Convene" / "Join" gave no clue that one of them needs a code
                you may not have. The labels now say which is which. */}
            <div className="vd-seg" role="tablist" aria-label="Start or join a game">
              <button
                role="tab"
                aria-selected={activeTab === "create"}
                className={activeTab === "create" ? "is-active" : undefined}
                onClick={() => setActiveTab("create")}
              >
                <span className="vd-seg__label">Start a game</span>
              </button>
              <button
                role="tab"
                aria-selected={activeTab === "join"}
                className={activeTab === "join" ? "is-active" : undefined}
                onClick={() => setActiveTab("join")}
              >
                <span className="vd-seg__label">Join a game</span>
              </button>
            </div>

            <label className="vd-field__label" htmlFor="gate-name">Your name</label>
            <input
              id="gate-name"
              className="vd-field"
              value={name}
              maxLength={16}
              onChange={(e) => { setName(e.target.value); setRejoinName(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") void gateSubmit(); }}
              placeholder="e.g. Priya"
              aria-describedby="gate-name-help"
              autoComplete="nickname"
            />
            <span className="vd-hint" id="gate-name-help">
              Everyone at the table sees this.
            </span>

            {activeTab === "join" && (
              <>
                <label className="vd-field__label" htmlFor="gate-code">Game code</label>
                <input
                  id="gate-code"
                  className="vd-field vd-field--code"
                  value={codeInput}
                  maxLength={4}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") void gateSubmit(); }}
                  placeholder="ABCD"
                  aria-describedby="gate-code-help"
                  autoCapitalize="characters"
                  autoCorrect="off"
                />
                <span className="vd-hint" id="gate-code-help">
                  Four letters, from whoever started it.
                </span>
              </>
            )}

            {/* One line, not a labelled box of three numbered steps.
            
                Everything the list said that a person actually needs before
                pressing the button is here: that a code is coming and has to
                be shared, and that five is the number. The rest — everyone
                joins on their own phone, the app deals the roles — is either
                obvious or is the next screen's job to show. */}
            <p className="vd-hint vd-gate__next">
              {activeTab === "create"
                ? "You'll get a 4-letter code to share. Start once five are in."
                : "You'll take a seat and be dealt a secret role."}
            </p>

            <button className="vd-btn vd-btn--primary" onClick={gateSubmit}>
              <span>{activeTab === "create" ? "Create the game" : "Join the game"}</span>
              <ArrowRight size={16} />
            </button>

            {rejoinName && (
              <div className="vd-panel" style={{ marginTop: 14 }}>
                <p className="vd-voice" style={{ margin: 0 }}>
                  Someone called <strong>{rejoinName}</strong> is already in
                  this game. If that was you — your phone died, or you closed
                  the tab — take your place back and you keep the same role.
                </p>
                <button
                  className="vd-btn"
                  style={{ marginTop: 12 }}
                  onClick={wrap(() => joinRoom(true))}
                >
                  <span>Yes, that's me — take my place back</span>
                  <LogIn size={16} />
                </button>
                <span className="vd-hint">
                  If it isn't you, pick a different name instead.
                </span>
              </div>
            )}

            {msg && <p className="vd-errline vd-panel vd-panel--danger">{msg}</p>}
          </div>

          <div className="vd-gate__worlds">
            {/* "Choose a world" named a concept the app never explained, and
                the locked tiles said only "premium world" — with the reason
                in a `title` tooltip, which never fires on a phone. */}
            <span className="vd-label">Setting {activeTab === "create" ? "(optional)" : ""}</span>
            <p className="vd-hint" style={{ marginTop: 4 }}>
              Only the names change. The rules never do.
            </p>
            {activeTab === "join" ? (
              // A joiner's pick here is discarded server-side — only the
              // host's setting applies. Leaving the grid interactive implied
              // otherwise.
              <p className="vd-voice" style={{ marginTop: 10 }}>
                The host picks the setting. You'll see theirs once you're in.
              </p>
            ) : (
              <div className="vd-worlds" style={{ marginTop: 10 }}>
                {THEME_LIST.map((t) => {
                  const on = t.id === localThemeId;
                  const paid = !premium && isPremiumTheme(t.id) && !on;
                  return (
                    <div key={t.id} className="vd-worldcell">
                      <button
                        className={`vd-world ${on ? "is-on" : ""}`}
                        disabled={paid}
                        aria-pressed={on}
                        onClick={() => setLocalThemeId(t.id)}
                      >
                        <span className="vd-world__body">
                          <span className="vd-world__name">{t.name}</span>
                          <span className="vd-world__sub">
                            Good: {t.goodTeamName} · Evil: {t.evilTeamName}
                          </span>
                        </span>
                        {on
                          ? <span className="vd-opt__lock"><Check size={13} /> Chosen</span>
                          : paid
                            ? <span className="vd-opt__lock"><Lock size={11} /> Paid</span>
                            : null}
                      </button>
                      {paid && (
                        <span className="vd-hint">
                          Included with a paid plan.{" "}
                          <a href={signedIn ? "/upgrade" : "/signin"}>
                            {signedIn ? "See plans" : "Sign in"}
                          </a>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <footer className="vd-gate__foot">
            <a className="vd-pill" href="/learn"><BookOpen size={13} /> How to play</a>
            <a className="vd-pill" href="/rules"><ScrollText size={13} /> Full rules</a>
            {signedIn ? (
              premium
                ? <span className="vd-pill vd-pill--brass"><BadgeCheck size={13} /> Paid plan</span>
                : <a className="vd-pill" href="/upgrade"><Crown size={13} /> Paid plan</a>
            ) : (
              <a className="vd-pill" href="/signin">
                <LogIn size={13} /> Sign in
              </a>
            )}
            {viewer?.isAdmin && (
              <a className="vd-pill" href="/admin"><Shield size={13} /> Admin</a>
            )}
          </footer>
        </div>
      </div>
    );
  }

}

/**
 * A code that led nowhere.
 *
 * "We couldn't find that game" was the only answer this screen had, and it
 * sends someone off to re-read four letters that were never wrong. A code that
 * has simply run out of its day is a different thing from a typo and gets told
 * so — `codeStatus` is asked only here, on a screen that is fetching nothing
 * else, because by this point `getRoom` has already come back empty.
 */
function CodeGone({ code, onBack }: { code: string; onBack: () => void }) {
  const status = useQuery(api.avalon.codeStatus, { code });
  const expired = status === "expired";

  return (
    <div className="vd-board">
      <div className="vd-content vd-gate">
        <div className="vd-studded vd-gate__card">
          <span className="vd-stud-b" aria-hidden />
          <h2 className="vd-h1">
            {expired ? "That game has expired" : "We couldn't find that game"}
          </h2>
          <p className="vd-voice" style={{ marginTop: 10 }}>
            {expired
              ? "Codes last 24 hours, and this one has run out. Nothing is lost — start a new game and share the fresh code."
              : "It has probably ended, or the code has a typo in it. Check the four letters with whoever set the game up and try again."}
          </p>
          <button
            className="vd-btn vd-btn--primary"
            style={{ marginTop: 18 }}
            onClick={onBack}
          >
            <span>{expired ? "Start a new game" : "Try another code"}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
/* StyleTag styles moved to src/styles.css */


