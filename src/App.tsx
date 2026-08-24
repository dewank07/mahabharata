import { useState, useEffect } from "react";
import type * as React from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import { useVoice } from "./useVoice";
import { RevealCeremony } from "./RevealCeremony";
import { Table, type TableActions } from "./table";
import emblemSrc from "./assets/emblem.png";
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
  Sparkles,
  Loader2,
  User,
  Key,
  Timer,
  Lock,
  Shield,
} from "lucide-react";

/* ============================ identity (per tab) ========================= */
// sessionStorage so each browser tab/window is a distinct warrior.
// Refresh in the same tab keeps the seat; a new incognito window gets a new id.
const PID_KEY = "kurukshetra.pid";
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
    sessionStorage.getItem("kurukshetra.code"),
  );
  const [msg, setMsg] = useState("");
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
    if (invite.length === 4 && !sessionStorage.getItem("kurukshetra.code")) {
      setCodeInput(invite);
      setActiveTab("join");
    }
  }, []);

  useEffect(() => {
    if (code) sessionStorage.setItem("kurukshetra.code", code);
    else sessionStorage.removeItem("kurukshetra.code");
    const url = new URL(window.location.href);
    if (code) url.searchParams.set("code", code);
    else if (url.searchParams.get("code")) url.searchParams.delete("code");
    const next = url.pathname + url.search + url.hash;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
      window.history.replaceState({}, "", next);
    }
  }, [code]);

  const room = useQuery(
    api.avalon.getRoom,
    code ? { code, playerId: pid } : "skip",
  );

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

  // The board palette is fixed, so nothing per-theme is injected any more. The
  // realm attribute stays only for the few decorative selectors in styles.css.
  useEffect(() => {
    document.documentElement.dataset.realm = activeTheme.id;
    return () => { delete document.documentElement.dataset.realm; };
  }, [activeTheme]);

  // Account + entitlement. Signing in is optional to play; it is what unlocks
  // the paid roles and boards, and what the admin console checks.
  const { signIn } = useAuthActions();
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

  const wrap = (fn: () => Promise<unknown>) => async () => {
    try {
      setMsg("");
      await fn();
    } catch (e: any) {
      setMsg(e?.message ?? "Something went wrong.");
    }
  };

  async function createRoom() {
    if (!name.trim()) return setMsg("Speak your name first.");
    const r = await mCreate({
      playerId: pid,
      name,
      themeId: localThemeId,
      opts,
    });
    setCode(r.code);
    setMsg("");
  }
  async function joinRoom() {
    if (!name.trim()) return setMsg("Speak your name first.");
    const c = codeInput.trim().toUpperCase();
    if (c.length !== 4) return setMsg("War-council codes are 4 letters.");
    const r = await mJoin({ code: c, playerId: pid, name });
    if (r.playerId && r.playerId !== pid) {
      sessionStorage.setItem(PID_KEY, r.playerId);
      setPid(r.playerId);
    }
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

  const voicePeers = players
    .filter((p) => p.inVoice && p.playerId !== pid)
    .map((p) => ({ playerId: p.playerId, name: p.name }));
  const voice = useVoice(code, pid, voicePeers);

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
    dealPlot: (toId) => mDealPlot({ code: code!, playerId: pid, toId }),
    playPlot: (card, targetId) =>
      mPlayPlot({ code: code!, playerId: pid, card: card as any, targetId }),
    discardPlot: (card) => mDiscardPlot({ code: code!, playerId: pid, card }),
    playKingReturns: () =>
      mPlayPlot({ code: code!, playerId: pid, card: "king_returns" }),
    passKingReturns: () => mPassKing({ code: code!, playerId: pid }),
  };

  /** `act` for the table: same error funnel as `wrap`, but takes a thunk. */
  const act = (fn: () => Promise<unknown>) => async () => {
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
            <Loader2 size={26} className="billing-spin" color="var(--vd-brass)" />
          </div>
        </div>
      )}
      {code && room === null && NotFound()}

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
          voice={voice}
          emblemSrc={emblemSrc}
          account={{
            signedIn: signedIn,
            isAdmin: viewer?.isAdmin === true,
            premium: premium,
            email: viewer?.email ?? null,
            signIn: () => void signIn("google"),
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
                  overturnedBy: room.lastVote.overturnedBy
                    ? (players.find(
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
                    name:
                      players.find((p) => p.playerId === r.playerId)?.name ??
                      "someone",
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
    return (
      <div className="vd-board">
        <div className="vd-content vd-gate">
          <header className="vd-gate__head">
            <img src={emblemSrc} alt="" width={30} height={30} className="vd-topbar__emblem" />
            <h1 className="vd-gate__brand">VERDICT</h1>
            <p className="vd-voice vd-gate__tag">{activeTheme.tagline}</p>
          </header>

          <div className="vd-studded vd-gate__card">
            <span className="vd-stud-b" aria-hidden />

            <div className="vd-seg">
              <button
                className={activeTab === "create" ? "is-active" : undefined}
                onClick={() => setActiveTab("create")}
              >
                <span className="vd-label" style={{ color: "inherit" }}>Convene</span>
              </button>
              <button
                className={activeTab === "join" ? "is-active" : undefined}
                onClick={() => setActiveTab("join")}
              >
                <span className="vd-label" style={{ color: "inherit" }}>Join</span>
              </button>
            </div>

            <label className="vd-field__label" htmlFor="gate-name">Your name</label>
            <input
              id="gate-name"
              className="vd-field"
              value={name}
              maxLength={16}
              onChange={(e) => setName(e.target.value)}
              placeholder="unique per warrior"
              autoComplete="nickname"
            />

            {activeTab === "join" && (
              <>
                <label className="vd-field__label" htmlFor="gate-code">Council code</label>
                <input
                  id="gate-code"
                  className="vd-field vd-field--code"
                  value={codeInput}
                  maxLength={4}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="ABCD"
                  autoCapitalize="characters"
                  autoCorrect="off"
                />
              </>
            )}

            <p className="vd-voice vd-gate__hint">
              {activeTab === "create"
                ? "A new council gets a four-letter code. Share the link and the code."
                : "Each tab needs its own name — reuse one and every window plays the same warrior."}
            </p>

            <button
              className="vd-btn vd-btn--primary"
              onClick={wrap(activeTab === "create" ? createRoom : joinRoom)}
            >
              <span>{activeTab === "create" ? "Convene a council" : "Join the council"}</span>
              <Sparkles size={15} />
            </button>

            {msg && <p className="vd-errline vd-panel vd-panel--danger">{msg}</p>}
          </div>

          <div className="vd-gate__worlds">
            <span className="vd-label">Choose a world</span>
            <div className="vd-worlds" style={{ marginTop: 10 }}>
              {THEME_LIST.map((t) => {
                const on = t.id === localThemeId;
                const paid = !premium && isPremiumTheme(t.id) && !on;
                return (
                  <button
                    key={t.id}
                    className={`vd-world ${on ? "is-on" : ""}`}
                    disabled={paid}
                    title={paid ? `${t.name} — premium world` : t.name}
                    onClick={() => setLocalThemeId(t.id)}
                  >
                    <span>
                      <span className="vd-world__name">{t.name}</span>
                      <span className="vd-world__sub">
                        {paid ? "premium world" : `${t.goodTeamName} vs ${t.evilTeamName}`}
                      </span>
                    </span>
                    {on && <Check size={13} color="var(--vd-brass)" style={{ marginLeft: "auto" }} />}
                    {paid && <Lock size={12} style={{ marginLeft: "auto" }} />}
                  </button>
                );
              })}
            </div>
          </div>

          <footer className="vd-gate__foot">
            <a className="vd-pill" href="#/rules"><ScrollText size={11} /> Rules</a>
            {signedIn ? (
              premium
                ? <span className="vd-pill vd-pill--brass"><BadgeCheck size={11} /> Premium</span>
                : <a className="vd-pill" href="#/upgrade"><Crown size={11} /> Upgrade</a>
            ) : (
              <button className="vd-pill" onClick={() => void signIn("google")}>
                <LogIn size={11} /> Sign in
              </button>
            )}
            {viewer?.isAdmin && (
              <a className="vd-pill" href="#/admin"><Shield size={11} /> Admin</a>
            )}
          </footer>
        </div>
      </div>
    );
  }

  function NotFound() {
    return (
      <div className="vd-board">
        <div className="vd-content vd-gate">
          <div className="vd-studded vd-gate__card">
            <span className="vd-stud-b" aria-hidden />
            <h2 className="vd-h2">No such council</h2>
            <p className="vd-voice" style={{ marginTop: 10 }}>
              It may have disbanded, or the code was mistyped.
            </p>
            <button
              className="vd-btn"
              style={{ marginTop: 18 }}
              onClick={() => { setCode(null); setMsg(""); }}
            >
              <span>Back to the gate</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

}
/* StyleTag styles moved to src/styles.css */


