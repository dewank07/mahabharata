import { useState, type CSSProperties } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useVoice } from "./useVoice";
import { THEMES, THEME_LIST } from "../convex/themes";
import {
  Crown,
  Sword,
  Eye,
  EyeOff,
  Users,
  ScrollText,
  Check,
  X,
  Flame,
  Sparkles,
  Swords,
  Copy,
  RefreshCw,
  LogOut,
  Loader2,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Video,
  VideoOff,
  Sun,
} from "lucide-react";

/* ============================ identity (persists) ========================= */
const PID_KEY = "kurukshetra.pid";
function loadPid(): string {
  let id = localStorage.getItem(PID_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    localStorage.setItem(PID_KEY, id);
  }
  return id;
}

/* ============================= role display meta ========================== */
type Role =
  | "merlin"
  | "percival"
  | "servant"
  | "assassin"
  | "morgana"
  | "mordred"
  | "oberon"
  | "minion";

const ROLE_TEAM: Record<
  Role,
  "good" | "evil"
> = {
  merlin: "good",
  percival: "good",
  servant: "good",
  assassin: "evil",
  morgana: "evil",
  mordred: "evil",
  oberon: "evil",
  minion: "evil",
};

const QUEST_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};
const TEAM_COUNTS: Record<number, [number, number]> = {
  5: [3, 2],
  6: [4, 2],
  7: [4, 3],
  8: [5, 3],
  9: [6, 3],
  10: [6, 4],
};
const DOUBLE_FAIL_QUEST = 3;

function getRoleMeta(role: string, theme: any) {
  return theme.roles.find((r: any) => r.id === role) ?? {
    name: role,
    team: ROLE_TEAM[role as Role] ?? "good",
    desc: "",
    knowledgeLabel: "",
  };
}

/* ================================ chakra crest =========================== */
function Chakra({
  size = 40,
  color = "#e3a93c",
}: {
  size?: number;
  color?: string;
}) {
  const spokes = Array.from({ length: 12 }, (_, i) => i * 30);
  const beads = Array.from({ length: 24 }, (_, i) => i * 15);
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 100 100'
      fill='none'
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap='round'
    >
      <circle cx='50' cy='50' r='31' />
      <circle cx='50' cy='50' r='9' fill={color} stroke='none' />
      {spokes.map((d) => {
        const a = (d * Math.PI) / 180;
        return (
          <line
            key={d}
            x1={50 + 11 * Math.cos(a)}
            y1={50 + 11 * Math.sin(a)}
            x2={50 + 31 * Math.cos(a)}
            y2={50 + 31 * Math.sin(a)}
          />
        );
      })}
      {beads.map((d) => {
        const a = (d * Math.PI) / 180;
        return (
          <circle
            key={d}
            cx={50 + 38 * Math.cos(a)}
            cy={50 + 38 * Math.sin(a)}
            r='1.5'
            fill={color}
            stroke='none'
          />
        );
      })}
    </svg>
  );
}

function CrestIcon({
  icon,
  size = 40,
  color = "var(--theme-gold)",
}: {
  icon: "chakra" | "shield" | "ankh" | "lightning" | "fort";
  size?: number;
  color?: string;
}) {
  if (icon === "shield") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" />
      </svg>
    );
  }
  if (icon === "ankh") {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="50" cy="32" r="15" fill="none" />
        <path d="M50 47v40M32 60h36" />
      </svg>
    );
  }
  if (icon === "lightning") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="none" />
      </svg>
    );
  }
  if (icon === "fort") {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 80V45l10-10h10V22h15v13h10V22h15v13h10l10 10v35H15z" fill="none" />
        <path d="M40 80V62c0-5 5-10 10-10s10 5 10 10v18" fill="none" />
      </svg>
    );
  }
  return <Chakra size={size} color={color} />;
}

const hasLiveVideo = (s?: MediaStream | null) =>
  !!s && s.getVideoTracks().some((t) => t.readyState === "live");
/* ================================ component =============================== */
export default function App() {
  const [pid] = useState(loadPid);
  const [name, setName] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [showRole, setShowRole] = useState(false);
  const [opts, setOpts] = useState({
    percival: true,
    morgana: true,
    mordred: false,
    oberon: false,
  });
  const [localThemeId, setLocalThemeId] = useState<string>("india");

  const room = useQuery(
    api.avalon.getRoom,
    code ? { code, playerId: pid } : "skip",
  );

  const activeTheme = room?.theme ?? THEMES[localThemeId] ?? THEMES.india;

  const getAccentGradient = (id: string): string => {
    switch (id) {
      case "medieval": return "#1c2d5a";
      case "egyptian": return "#2d2013";
      case "greek": return "#162238";
      case "maratha": return "#4a1c02";
      case "india":
      default:
        return "#3a1d4d";
    }
  };

  const styleVariables = {
    "--theme-ink": activeTheme.colors.ink,
    "--theme-ink2": activeTheme.colors.ink2,
    "--theme-panel": activeTheme.colors.panel,
    "--theme-panel2": activeTheme.colors.panel2,
    "--theme-line": activeTheme.colors.line,
    "--theme-gold": activeTheme.colors.gold,
    "--theme-gold-dim": activeTheme.colors.goldDim,
    "--theme-parch": activeTheme.colors.parch,
    "--theme-parch-dim": activeTheme.colors.parchDim,
    "--theme-good": activeTheme.colors.good,
    "--theme-good-dk": activeTheme.colors.goodDk,
    "--theme-evil": activeTheme.colors.evil,
    "--theme-evil-dk": activeTheme.colors.evilDk,
    "--theme-accent-gradient": getAccentGradient(activeTheme.id),
  } as CSSProperties;

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
    const r = await mCreate({ playerId: pid, name, themeId: localThemeId, opts });
    setCode(r.code);
    setMsg("");
  }
  async function joinRoom() {
    if (!name.trim()) return setMsg("Speak your name first.");
    const c = codeInput.trim().toUpperCase();
    if (c.length !== 4) return setMsg("War-council codes are 4 letters.");
    const r = await mJoin({ code: c, playerId: pid, name });
    if (r.playerId && r.playerId !== pid)
      localStorage.setItem(PID_KEY, r.playerId);
    setCode(r.code);
    setMsg("");
  }
  function leaveRoom() {
    if (code) mLeave({ code, playerId: pid }).catch(() => {});
    setCode(null);
    setShowRole(false);
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

  /* =============================== render =============================== */
  return (
    <div style={{ ...st.root, ...styleVariables }}>
      <StyleTag />
      <div style={st.shell}>
        {!code && Home()}
        {code && room === undefined && (
          <div style={st.center}>
            <Loader2 size={28} style={{ ...st.spin, color: C.gold }} />
          </div>
        )}
        {code && room === null && NotFound()}
        {code && room && room.phase === "lobby" && Lobby()}
        {code && room && room.phase === "reveal" && Reveal()}
        {code &&
          room &&
          ["propose", "vote", "quest"].includes(room.phase) &&
          GameTable()}
        {code && room && room.phase === "assassin" && Assassin()}
        {code && room && room.phase === "end" && EndScreen()}
      </div>
    </div>
  );

  /* =============================== CIRCLE TABLE ============================ */
  function GameTable() {
    const size = QUEST_SIZES[n][room!.questIndex];
    const onTeam = room!.proposedTeam.includes(pid);
    // Compute circular positions for players
    const radius = Math.min(160, 120 + n * 4); // responsive radius
    const angleOffset = -Math.PI / 2; // start from top

    return (
      <div style={st.panelWrap}>
        {Header()}
        {/* Voice controls bar */}
        {VoiceBar()}

        {/* Circular table */}
        <div style={{ ...st.tableContainer, height: radius * 2 + 120 }}>
          {/* Center content */}
          <div style={st.tableCenter}>
            {QuestTrackerCompact()}
            {VoteTrack()}
            <div style={st.centerPhase}>
              {room!.phase === "propose" && (
                <span style={st.phaseText}>
                  <Crown size={14} color={C.gold} /> {leader?.name} proposes
                </span>
              )}
              {room!.phase === "vote" && (
                <span style={st.phaseText}>
                  <Swords size={14} color={C.gold} /> Council votes
                </span>
              )}
              {room!.phase === "quest" && (
                <span style={st.phaseText}>
                  <Sword size={14} color={C.gold} /> Battle{" "}
                  {room!.questIndex + 1}
                </span>
              )}
            </div>
          </div>

          {/* Players around the circle */}
          {players.map((p, i) => {
            const angle = angleOffset + (2 * Math.PI * i) / n;
            const x = radius * Math.cos(angle);
            const y = radius * Math.sin(angle);
            const isMe = p.playerId === pid;
            const isLdr = p.playerId === leader?.playerId;
            const isPicked = picked.includes(p.playerId);
            const isOnProposedTeam = room!.proposedTeam.includes(p.playerId);
            const isSpeaking = isMe
              ? !!voice.speaking["me"]
              : !!voice.speaking[p.playerId];
            const stream = isMe
              ? voice.localStream
              : voice.remoteStreams[p.playerId];
            const hasVid = isMe ? voice.camOn : hasLiveVideo(stream);

            // Determine ring color
            let ringColor = C.line;
            if (isOnProposedTeam && room!.phase !== "propose")
              ringColor = C.gold;
            if (isPicked) ringColor = C.gold;
            if (isSpeaking) ringColor = C.good;

            const canSelect = room!.phase === "propose" && isLeader;
            const seatClick = canSelect
              ? () => {
                  setPicked((q) =>
                    isPicked
                      ? q.filter((x) => x !== p.playerId)
                      : q.length < size
                        ? [...q, p.playerId]
                        : q,
                  );
                }
              : undefined;

            return (
              <div
                key={p.playerId}
                onClick={seatClick}
                style={{
                  ...st.seatNode,
                  left: `calc(50% + ${x}px - 32px)`,
                  top: `calc(50% + ${y}px - 32px)`,
                  cursor: canSelect ? "pointer" : "default",
                }}
              >
                {/* Avatar circle */}
                <div
                  style={{
                    ...st.avatarRing,
                    borderColor: ringColor,
                    boxShadow: isSpeaking
                      ? `0 0 0 4px rgba(63,159,142,.3)`
                      : isPicked
                        ? `0 0 0 3px rgba(227,169,60,.25)`
                        : "none",
                  }}
                >
                  {hasVid && stream ? (
                    <video
                      autoPlay
                      playsInline
                      muted={isMe}
                      ref={(el) => {
                        if (el && stream && el.srcObject !== stream)
                          el.srcObject = stream;
                      }}
                      style={{
                        ...st.avatarVideo,
                        transform: isMe ? "scaleX(-1)" : "none",
                      }}
                    />
                  ) : (
                    <div style={st.avatarLetter}>
                      {p.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  {/* Mic indicator */}
                  {voice.joined && p.inVoice && (
                    <div style={st.micBadge}>
                      {isMe && voice.muted ? (
                        <MicOff size={9} color={C.evil} />
                      ) : (
                        <Mic
                          size={9}
                          color={isSpeaking ? C.good : C.parchDim}
                        />
                      )}
                    </div>
                  )}
                  {/* Crown for leader */}
                  {isLdr && (
                    <div style={st.crownBadge}>
                      <Crown size={11} color={C.gold} />
                    </div>
                  )}
                  {/* Selected check */}
                  {isPicked && (
                    <div style={st.checkBadge}>
                      <Check size={10} color={C.ink} />
                    </div>
                  )}
                </div>
                {/* Name below */}
                <div style={{ ...st.seatName, color: isMe ? C.gold : C.parch }}>
                  {p.name.length > 7 ? p.name.slice(0, 6) + "…" : p.name}
                  {isMe && <span style={st.youTag}>you</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action area below the table */}
        <div style={st.actionArea}>
          {room!.lastVote && room!.phase === "propose" && LastVoteBanner()}
          {room!.lastQuest && room!.phase === "propose" && LastQuestBanner()}

          {room!.phase === "propose" && isLeader && (
            <div style={st.actionCard}>
              <div style={st.actionTitle}>
                Tap warriors in the circle to select your party ({picked.length}
                /{size})
              </div>
              <button
                style={{
                  ...st.btnGold,
                  marginTop: 10,
                  opacity: picked.length === size ? 1 : 0.5,
                }}
                disabled={picked.length !== size}
                onClick={wrap(async () => {
                  await mPropose({ code: code!, playerId: pid, team: picked });
                  setPicked([]);
                })}
              >
                Put the party to the council
              </button>
            </div>
          )}
          {room!.phase === "propose" && !isLeader && (
            <div style={st.waitCard}>
              <Loader2 size={16} style={{ ...st.spin, color: C.gold }} />
              <span>{leader?.name} is choosing a war party…</span>
            </div>
          )}

          {room!.phase === "vote" && VotePanel()}
          {room!.phase === "quest" && QuestPanel(onTeam)}
        </div>

        {SecretRole()}
        {msg && <p style={st.error}>{msg}</p>}
        <button style={st.leave} onClick={leaveRoom}>
          <LogOut size={14} /> Leave
        </button>
      </div>
    );
  }

  /* ------------------------------- screens ------------------------------ */
  function Home() {
    return (
      <div style={st.home}>
        <div style={st.crest}>
          <CrestIcon icon={activeTheme.crestIcon} size={46} color={C.gold} />
        </div>
        <h1 style={st.title}>{activeTheme.name}</h1>
        {activeTheme.devanagariLabel && (
          <div style={st.deva}>{activeTheme.devanagariLabel}</div>
        )}
        <p style={st.subtitle}>
          {activeTheme.tagline}
        </p>
        <div style={st.card}>
          <label style={st.label}>Select Game Theme</label>
          <select
            value={localThemeId}
            onChange={(e) => setLocalThemeId(e.target.value)}
            style={{
              ...st.input,
              background: C.ink2,
              color: C.parch,
              border: `1px solid ${C.line}`,
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: serifBody,
              padding: "8px 12px",
              marginBottom: 14,
              width: "100%",
            }}
          >
            {THEME_LIST.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <label style={st.label}>Your name</label>
          <input
            style={st.input}
            value={name}
            maxLength={16}
            onChange={(e) => setName(e.target.value)}
            placeholder='Your name…'
          />
          <div style={{ height: 14 }} />
          <button style={st.btnGold} onClick={wrap(createRoom)}>
            <Sparkles size={16} /> Convene a War Council
          </button>
          <div style={st.or}>
            <span>or</span>
          </div>
          <label style={st.label}>Council code</label>
          <input
            style={{
              ...st.input,
              letterSpacing: 6,
              textTransform: "uppercase",
              fontWeight: 700,
            }}
            value={codeInput}
            maxLength={4}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder='ABCD'
          />
          <div style={{ height: 10 }} />
          <button style={st.btnGhost} onClick={wrap(joinRoom)}>
            Join a War Council
          </button>
          {msg && <p style={st.error}>{msg}</p>}
        </div>
        <p style={st.foot}>
          Share this URL + the council code with your warriors. State syncs live
          through Convex — talk and see one another over free peer-to-peer audio
          &amp; video.
        </p>
      </div>
    );
  }

  function NotFound() {
    return (
      <div style={st.panelWrap}>
        <p style={st.waiting}>No such council (it may have disbanded).</p>
        <button
          style={st.btnGhost}
          onClick={() => {
            setCode(null);
            setMsg("");
          }}
        >
          Back
        </button>
      </div>
    );
  }

  function Lobby() {
    const evilSlots = TEAM_COUNTS[Math.max(n, 5)][1] - 1;
    const evilPicked =
      (opts.morgana ? 1 : 0) + (opts.mordred ? 1 : 0) + (opts.oberon ? 1 : 0);
    const toggle = (k: keyof typeof opts) => {
      const next = { ...opts, [k]: !opts[k] };
      setOpts(next);
      if (code) mSetOpts({ code, playerId: pid, opts: next }).catch(() => {});
    };

    const merlinName = activeTheme.roles.find(r => r.id === "merlin")?.name || "Merlin";
    const percivalName = activeTheme.roles.find(r => r.id === "percival")?.name || "Percival";
    const assassinName = activeTheme.roles.find(r => r.id === "assassin")?.name || "Assassin";
    const morganaName = activeTheme.roles.find(r => r.id === "morgana")?.name || "Morgana";
    const mordredName = activeTheme.roles.find(r => r.id === "mordred")?.name || "Mordred";
    const oberonName = activeTheme.roles.find(r => r.id === "oberon")?.name || "Oberon";

    const handleThemeChange = (newThemeId: string) => {
      if (code) {
        mChangeTheme({ code, playerId: pid, themeId: newThemeId }).catch((err) => console.error(err));
      }
    };

    return (
      <div style={st.panelWrap}>
        {Header()}
        {VoiceBar()}
        <div style={st.codeBanner}>
          <span style={st.codeLabel}>COUNCIL CODE</span>
          <span style={st.codeBig}>{room!.code}</span>
          <button
            style={st.copyBtn}
            onClick={() => navigator.clipboard?.writeText(room!.code)}
          >
            <Copy size={14} /> copy
          </button>
        </div>

        <div style={{ marginBottom: 16, marginTop: 8 }}>
          <label style={{ ...st.label, marginBottom: 6, display: "block" }}>Game Theme</label>
          {isHost ? (
            <select
              value={activeTheme.id}
              onChange={(e) => handleThemeChange(e.target.value)}
              style={{
                ...st.input,
                padding: "8px 12px",
                background: C.ink2,
                color: C.parch,
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                width: "100%",
                cursor: "pointer",
                fontFamily: serifBody,
              }}
            >
              {THEME_LIST.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.tagline}
                </option>
              ))}
            </select>
          ) : (
            <div
              style={{
                padding: "10px 14px",
                background: C.panel,
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                fontSize: 14.5,
                color: C.parchDim,
              }}
            >
              <span style={{ color: C.gold, fontWeight: 600 }}>{activeTheme.name}</span> — {activeTheme.tagline}
            </div>
          )}
        </div>

        <h2 style={st.h2}>
          <Users size={18} /> Warriors gathered ({n}/10)
        </h2>
        <div style={st.playerGrid}>
          {players.map((p) => (
            <div
              key={p.playerId}
              style={{
                ...st.playerChip,
                ...(p.playerId === pid ? st.playerChipMe : {}),
              }}
            >
              {p.isHost && <Crown size={13} color={C.gold} />}
              {p.name}
              {p.playerId === pid && " (you)"}
            </div>
          ))}
        </div>
        {isHost ? (
          <>
            <h2 style={st.h2}>
              <ScrollText size={18} /> Roles of legend
            </h2>
            <div style={st.optGrid}>
              <RoleToggle
                label={percivalName}
                team='good'
                desc={`Sees ${merlinName} & ${morganaName}`}
                on={opts.percival}
                onClick={() => toggle("percival")}
              />
              <RoleToggle
                label={morganaName}
                team='evil'
                desc={`Appears as ${merlinName}`}
                on={opts.morgana}
                disabled={!opts.morgana && evilPicked >= evilSlots}
                onClick={() => toggle("morgana")}
              />
              <RoleToggle
                label={mordredName}
                team='evil'
                desc={`Veiled from ${merlinName}`}
                on={opts.mordred}
                disabled={!opts.mordred && evilPicked >= evilSlots}
                onClick={() => toggle("mordred")}
              />
              <RoleToggle
                label={oberonName}
                team='evil'
                desc={`Lone, unknown ${activeTheme.evilTeamName}`}
                on={opts.oberon}
                disabled={!opts.oberon && evilPicked >= evilSlots}
                onClick={() => toggle("oberon")}
              />
            </div>
            <p style={st.note}>
              {merlinName} &amp; {assassinName} always take the field. Special
              slots used: {evilPicked}/{evilSlots}.
            </p>
            <button
              style={{ ...st.btnGold, marginTop: 8, opacity: n < 5 ? 0.5 : 1 }}
              disabled={n < 5}
              onClick={wrap(() => mStart({ code: code!, playerId: pid }))}
            >
              <Swords size={16} />{" "}
              {n < 5
                ? `Need ${5 - n} more warrior${5 - n > 1 ? "s" : ""}`
                : "Cast the lots & begin the war"}
            </button>
          </>
        ) : (
          <p style={st.waiting}>Awaiting the host to cast the lots of fate…</p>
        )}
        {msg && <p style={st.error}>{msg}</p>}
        <button style={st.leave} onClick={leaveRoom}>
          <LogOut size={14} /> Leave council
        </button>
      </div>
    );
  }

  function RoleToggle({
    label,
    team,
    desc,
    on,
    disabled,
    onClick,
  }: {
    label: string;
    team: "good" | "evil";
    desc: string;
    on: boolean;
    disabled?: boolean;
    onClick: () => void;
  }) {
    return (
      <button
        disabled={disabled}
        onClick={onClick}
        style={{
          ...st.optBtn,
          borderColor: on ? (team === "good" ? C.good : C.evil) : C.line,
          background: on
            ? team === "good"
              ? "rgba(63,159,142,.14)"
              : "rgba(193,74,63,.14)"
            : C.panel,
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {team === "good" ? (
            <Sun size={14} color={C.good} />
          ) : (
            <Flame size={14} color={C.evil} />
          )}
          <strong style={{ color: C.parch }}>{label}</strong>
          {on && (
            <Check size={14} color={C.gold} style={{ marginLeft: "auto" }} />
          )}
        </div>
        <span style={st.optDesc}>{desc}</span>
      </button>
    );
  }

  function Reveal() {
    if (!myRole) return <p style={st.waiting}>The lots are cast…</p>;
    const meta = getRoleMeta(myRole, activeTheme);
    const good = meta.team === "good";
    return (
      <div style={st.panelWrap}>
        {Header()}
        {VoiceBar()}
        <div
          style={{
            ...st.roleCard,
            borderColor: good ? C.good : C.evil,
            background: good
              ? "linear-gradient(160deg,#14352f,#1b1130)"
              : "linear-gradient(160deg,#34160f,#1b1130)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {good ? (
              <Sun size={26} color={C.good} />
            ) : (
              <Flame size={26} color={C.evil} />
            )}
            <div>
              <div style={st.roleTeam}>
                {good
                  ? `Sworn to Good · ${activeTheme.goodTeamName}`
                  : `Sworn to Evil · ${activeTheme.evilTeamName}`}
              </div>
              <div style={st.roleName}>{meta.name}</div>
            </div>
          </div>
          <p style={st.roleDesc}>{meta.desc}</p>
          <div style={st.knowBox}>
            <div style={st.knowLabel}>{meta.knowledgeLabel}</div>
            {room!.me!.known.length > 0 ? (
              <div style={st.knowNames}>
                {room!.me!.known.map((nm) => (
                  <span key={nm} style={st.knowName}>
                    <Eye size={13} color={C.gold} /> {nm}
                  </span>
                ))}
              </div>
            ) : (
              <div style={st.knowEmpty}>— nothing revealed —</div>
            )}
          </div>
        </div>
        {isHost ? (
          <button
            style={{ ...st.btnGold, marginTop: 16 }}
            onClick={wrap(() => mBegin({ code: code!, playerId: pid }))}
          >
            <Sword size={16} /> All have learned their roles — begin the quests
          </button>
        ) : (
          <p style={st.waiting}>
            Study your role. The host will start the quests shortly…
          </p>
        )}
      </div>
    );
  }

  function Assassin() {
    const amAssassin = myRole === "assassin";
    const merlinName = activeTheme.roles.find(r => r.id === "merlin")?.name || "Merlin";
    const assassinName = activeTheme.roles.find(r => r.id === "assassin")?.name || "Assassin";
    return (
      <div style={st.panelWrap}>
        {Header()}
        {VoiceBar()}
        {QuestTrackerCompact()}
        <div
          style={{
            ...st.roleCard,
            borderColor: C.evil,
            background: "linear-gradient(160deg,#34160f,#1b1130)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Flame size={26} color={C.evil} />
            <div style={st.roleName}>The {activeTheme.goodTeamName} have completed three quests…</div>
          </div>
          <p style={st.roleDesc}>
            Yet {assassinName} may still turn the tide. If {merlinName} is named,
            the {activeTheme.evilTeamName} seize victory.
          </p>
        </div>
        {amAssassin ? (
          <div style={st.actionCard}>
            <div style={st.actionTitle}>
              Name the player you believe is {merlinName}
            </div>
            <div style={st.seatGrid}>
              {players
                .filter((p) => p.playerId !== pid)
                .map((p) => (
                  <button
                    key={p.playerId}
                    style={st.seat}
                    onClick={wrap(() =>
                      mAssassinate({
                        code: code!,
                        playerId: pid,
                        targetId: p.playerId,
                      }),
                    )}
                  >
                    <Eye size={13} color={C.gold} /> {p.name}
                  </button>
                ))}
            </div>
          </div>
        ) : (
          <p style={st.waiting}>
            The assassin stalks the night… your fate hangs in the balance.
          </p>
        )}
      </div>
    );
  }

  function EndScreen() {
    const goodWon = room!.winner === "good";
    return (
      <div style={st.panelWrap}>
        {Header()}
        {VoiceBar()}
        <div
          style={{
            ...st.endBanner,
            borderColor: goodWon ? C.good : C.evil,
            background: goodWon
              ? "linear-gradient(160deg,#14352f,#1b1130)"
              : "linear-gradient(160deg,#34160f,#1b1130)",
          }}
        >
          {goodWon ? (
            <Sun size={34} color={C.good} />
          ) : (
            <Flame size={34} color={C.evil} />
          )}
          <div style={st.endTitle}>
            {goodWon ? "Good Prevails" : "Evil Triumphs"}
          </div>
          <p style={st.endReason}>{room!.winReason}</p>
        </div>
        {QuestTrackerCompact()}
        <h2 style={st.h2}>
          <ScrollText size={18} /> The allegiances revealed
        </h2>
        <div style={st.revealGrid}>
          {players.map((p) => {
            const r = p.role ? getRoleMeta(p.role, activeTheme) : null;
            const good = r?.team === "good";
            return (
              <div
                key={p.playerId}
                style={{
                  ...st.revealRow,
                  borderColor: good ? C.goodDk : C.evilDk,
                  background: good
                    ? "rgba(63,159,142,.08)"
                    : "rgba(193,74,63,.08)",
                }}
              >
                {good ? (
                  <Sun size={15} color={C.good} />
                ) : (
                  <Flame size={15} color={C.evil} />
                )}
                <strong style={{ color: C.parch }}>{p.name}</strong>
                <span
                  style={{
                    marginLeft: "auto",
                    color: good ? C.good : C.evil,
                    fontWeight: 600,
                  }}
                >
                  {r?.name}
                </span>
                {room!.assassinGuess === p.playerId && (
                  <span style={st.daggerTag}>🏹 named</span>
                )}
              </div>
            );
          })}
        </div>
        {isHost ? (
          <button
            style={{ ...st.btnGold, marginTop: 16 }}
            onClick={wrap(() => mNewGame({ code: code!, playerId: pid }))}
          >
            <RefreshCw size={16} /> Wage war anew (same warriors)
          </button>
        ) : (
          <p style={st.waiting}>Awaiting the host to wage war anew…</p>
        )}
        <button style={st.leave} onClick={leaveRoom}>
          <LogOut size={14} /> Leave council
        </button>
      </div>
    );
  }

  /* ------------------------------ shared panels -------------------------- */
  function VoiceBar() {
    if (!voice) return null;
    const inCall = players.filter((p) => p.inVoice);
    return (
      <div style={st.voiceBar}>
        <div style={st.voiceLeft}>
          <CrestIcon icon={activeTheme.crestIcon} size={14} color={voice.joined ? C.good : C.parchDim} />
          <span style={st.voiceTitle}>War Council</span>
          {inCall.length > 0 ? (
            <span style={st.voiceHint}>{inCall.length} present</span>
          ) : (
            <span style={st.voiceHint}>empty</span>
          )}
        </div>
        <div style={st.voiceRight}>
          {!voice.joined ? (
            <button style={st.voiceJoin} onClick={() => voice.join()}>
              <PhoneCall size={13} /> Join
            </button>
          ) : (
            <>
              <button
                style={st.voiceIconBtn}
                onClick={voice.toggleMute}
                title={voice.muted ? "Unmute" : "Mute"}
              >
                {voice.muted ? (
                  <MicOff size={15} color={C.evil} />
                ) : (
                  <Mic size={15} color={C.good} />
                )}
              </button>
              <button
                style={st.voiceIconBtn}
                onClick={() => voice.toggleCamera()}
                title={voice.camOn ? "Stop camera" : "Start camera"}
              >
                {voice.camOn ? (
                  <Video size={15} color={C.good} />
                ) : (
                  <VideoOff size={15} color={C.parchDim} />
                )}
              </button>
              <button
                style={st.voiceLeaveBtn}
                onClick={() => voice.leave()}
                title='Leave voice'
              >
                <PhoneOff size={14} color={C.parch} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  function VotePanel() {
    const voted = room!.voteProgress.iVoted;
    const team = room!.proposedTeam.map(
      (id) => players.find((p) => p.playerId === id)?.name,
    );
    return (
      <div style={st.actionCard}>
        <div style={st.actionTitle}>Vote on the war party</div>
        <div style={st.teamPills}>
          {team.map((t) => (
            <span key={t} style={st.teamPill}>
              <Sword size={12} color={C.gold} /> {t}
            </span>
          ))}
        </div>
        {!voted ? (
          <div style={st.voteBtns}>
            <button
              style={st.approve}
              onClick={wrap(() =>
                mVote({ code: code!, playerId: pid, choice: "approve" }),
              )}
            >
              <Check size={18} /> Support
            </button>
            <button
              style={st.reject}
              onClick={wrap(() =>
                mVote({ code: code!, playerId: pid, choice: "reject" }),
              )}
            >
              <X size={18} /> Oppose
            </button>
          </div>
        ) : (
          <div style={st.waitCard}>
            <Loader2 size={16} style={{ ...st.spin, color: C.gold }} /> Voice
            given — {room!.voteProgress.voted}/{room!.voteProgress.total} in…
          </div>
        )}
      </div>
    );
  }

  function QuestPanel(onTeam: boolean) {
    const played = room!.questProgress.iSubmitted;
    const isEvil = myRole ? ROLE_TEAM[myRole] === "evil" : false;
    return (
      <div style={st.actionCard}>
        <div style={st.actionTitle}>Quest {room!.questIndex + 1} rages</div>
        {onTeam ? (
          !played ? (
            <>
              <p style={st.note}>
                You march in this quest. Commit your deed in secret.
              </p>
              <div style={st.voteBtns}>
                <button
                  style={st.approve}
                  onClick={wrap(() =>
                    mCard({ code: code!, playerId: pid, card: "success" }),
                  )}
                >
                  <Check size={18} /> Success
                </button>
                <button
                  style={{
                    ...st.reject,
                    opacity: isEvil ? 1 : 0.4,
                    cursor: isEvil ? "pointer" : "not-allowed",
                  }}
                  disabled={!isEvil}
                  onClick={wrap(() =>
                    mCard({ code: code!, playerId: pid, card: "fail" }),
                  )}
                >
                  <X size={18} /> Fail {isEvil ? "" : "🔒"}
                </button>
              </div>
              {!isEvil && (
                <p style={st.noteDim}>
                  Those sworn to Good must fight for Success.
                </p>
              )}
            </>
          ) : (
            <div style={st.waitCard}>
              <Loader2 size={16} style={{ ...st.spin, color: C.gold }} /> Deed
              committed — {room!.questProgress.submitted}/
              {room!.questProgress.total} in…
            </div>
          )
        ) : (
          <div style={st.waitCard}>
            <Loader2 size={16} style={{ ...st.spin, color: C.gold }} /> The
            chosen party rides to battle…
          </div>
        )}
      </div>
    );
  }

  function QuestTrackerCompact() {
    return (
      <div style={st.tracker}>
        {QUEST_SIZES[Math.max(n, 5)].map((sz, i) => {
          const res = room!.questResults[i];
          const cur =
            ["propose", "vote", "quest"].includes(room!.phase) &&
            i === room!.questIndex;
          const dbl = i === DOUBLE_FAIL_QUEST && n >= 7;
          return (
            <div
              key={i}
              style={{
                ...st.questOrb,
                borderColor:
                  res === "success"
                    ? C.good
                    : res === "fail"
                      ? C.evil
                      : cur
                        ? C.gold
                        : C.line,
                background:
                  res === "success"
                    ? "rgba(63,159,142,.25)"
                    : res === "fail"
                      ? "rgba(193,74,63,.25)"
                      : cur
                        ? "rgba(227,169,60,.12)"
                        : C.panel,
                boxShadow: cur ? "0 0 0 2px rgba(227,169,60,.25)" : "none",
              }}
            >
              <span style={st.questNum}>
                {sz}
                {dbl ? "²" : ""}
              </span>
              <span style={st.questSub}>B{i + 1}</span>
              {res === "success" && (
                <Check size={11} color={C.good} style={st.orbMark} />
              )}
              {res === "fail" && (
                <X size={11} color={C.evil} style={st.orbMark} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function VoteTrack() {
    return (
      <div style={st.voteTrack}>
        <span style={st.voteTrackLabel}>Rejects</span>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            style={{
              ...st.pip,
              background: i < room!.rejectCount ? C.evil : "transparent",
              borderColor: i === 4 ? C.evil : C.line,
            }}
          />
        ))}
        {room!.rejectCount >= 3 && <span style={st.dangerText}>!</span>}
      </div>
    );
  }

  function LastVoteBanner() {
    const v = room!.lastVote!;
    const nm = (id: string) =>
      players.find((p) => p.playerId === id)?.name ?? "?";
    return (
      <div
        style={{ ...st.banner, borderColor: v.approved ? C.goodDk : C.evilDk }}
      >
        <div style={st.bannerHead}>
          {v.approved ? "✓ Party sent to battle" : "✕ Party turned away"}
        </div>
        <div style={st.bannerRow}>
          <Check size={12} color={C.good} />{" "}
          {v.approvers.map(nm).join(", ") || "—"}
        </div>
        <div style={st.bannerRow}>
          <X size={12} color={C.evil} /> {v.rejecters.map(nm).join(", ") || "—"}
        </div>
      </div>
    );
  }

  function LastQuestBanner() {
    const q = room!.lastQuest!;
    return (
      <div
        style={{ ...st.banner, borderColor: q.success ? C.goodDk : C.evilDk }}
      >
        <div style={st.bannerHead}>
          Quest {q.questIndex + 1}:{" "}
          {q.success ? "Won for Good" : "Lost to Evil"}
        </div>
        <div style={st.bannerRow}>
          {q.fails} act{q.fails !== 1 ? "s" : ""} of sabotage
        </div>
      </div>
    );
  }

  function SecretRole() {
    if (!myRole) return null;
    const meta = getRoleMeta(myRole, activeTheme);
    const good = meta.team === "good";
    return (
      <div style={st.secretWrap}>
        <button style={st.secretBtn} onClick={() => setShowRole((s) => !s)}>
          {showRole ? <EyeOff size={14} /> : <Eye size={14} />}{" "}
          {showRole ? "Conceal my role" : "Glimpse my role"}
        </button>
        {showRole && (
          <div
            style={{ ...st.secretCard, borderColor: good ? C.good : C.evil }}
          >
            <strong style={{ color: good ? C.good : C.evil }}>
              {meta.name}
            </strong>
            <span style={{ color: C.parchDim, fontSize: 12 }}>
              {" "}
              — {good ? "Good" : "Evil"}
            </span>
          </div>
        )}
      </div>
    );
  }

  /* ------------------------------ fragments ----------------------------- */
  function Header() {
    return (
      <div style={st.header}>
        <div style={st.headerL}>
          <CrestIcon icon={activeTheme.crestIcon} size={20} color={C.gold} />
          <span style={st.headerTitle}>{activeTheme.name}</span>
        </div>
        {me && <span style={st.headerName}>{me.name}</span>}
      </div>
    );
  }
}
/* ------------------------------ fonts / css ----------------------------- */
function StyleTag() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Rozha+One&family=Spectral:ital,wght@0,400;0,500;0,600;1,400&display=swap');
      *{ box-sizing:border-box; } html,body,#root{ margin:0; min-height:100%; }
      body{ background: var(--theme-ink); transition: background 0.3s ease; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes fadeUp { from { opacity:0; transform:translateY(8px);} to {opacity:1;transform:none;} }
      @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(63,159,142,.4); } 50% { box-shadow: 0 0 0 6px rgba(63,159,142,0); } }
      ::-webkit-scrollbar { width: 8px; } ::-webkit-scrollbar-thumb { background: var(--theme-line); border-radius:4px; }
      input:focus { outline: none; border-color: var(--theme-gold) !important; }
      button { font-family: 'Spectral', Georgia, serif; cursor: pointer; }
    `}</style>
  );
}

/* -------------------------------- palette ------------------------------- */
const C = {
  ink: "var(--theme-ink)",
  ink2: "var(--theme-ink2)",
  panel: "var(--theme-panel)",
  panel2: "var(--theme-panel2)",
  line: "var(--theme-line)",
  gold: "var(--theme-gold)",
  goldDim: "var(--theme-gold-dim)",
  parch: "var(--theme-parch)",
  parchDim: "var(--theme-parch-dim)",
  good: "var(--theme-good)",
  goodDk: "var(--theme-good-dk)",
  evil: "var(--theme-evil)",
  evilDk: "var(--theme-evil-dk)",
};
const serifDisplay = "'Rozha One', Georgia, serif";
const serifBody = "'Spectral', Georgia, serif";

/* -------------------------------- styles -------------------------------- */
const st: Record<string, CSSProperties> = {
  root: {
    fontFamily: serifBody,
    minHeight: "100vh",
    color: C.parch,
    background: "radial-gradient(1200px 620px at 50% -12%, var(--theme-accent-gradient) 0%, var(--theme-ink) 56%)",
    transition: "background 0.3s ease",
    padding: "18px 12px",
  },
  shell: { maxWidth: 580, margin: "0 auto" },
  center: { display: "flex", justifyContent: "center", padding: 60 },
  spin: { animation: "spin 1s linear infinite" },

  /* Home */
  home: { textAlign: "center", animation: "fadeUp .4s ease" },
  crest: {
    width: 78,
    height: 78,
    margin: "10px auto 4px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `2px solid ${C.goldDim}`,
    background: C.panel,
    boxShadow: "0 6px 28px rgba(0,0,0,.55)",
  },
  title: {
    fontFamily: serifDisplay,
    fontSize: 40,
    color: C.gold,
    margin: "8px 0 0",
    letterSpacing: 0.5,
  },
  deva: {
    fontFamily: serifBody,
    fontSize: 14,
    color: C.goldDim,
    letterSpacing: 3,
    marginBottom: 8,
  },
  subtitle: {
    color: C.parchDim,
    fontSize: 15,
    margin: "0 0 22px",
    fontStyle: "italic",
  },
  card: {
    background: C.panel,
    border: `1px solid ${C.line}`,
    borderRadius: 14,
    padding: 20,
    textAlign: "left",
    boxShadow: "0 10px 30px rgba(0,0,0,.45)",
  },
  label: {
    display: "block",
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: C.parchDim,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "11px 13px",
    borderRadius: 9,
    border: `1px solid ${C.line}`,
    background: C.ink2,
    color: C.parch,
    fontSize: 16,
    fontFamily: serifBody,
  },
  or: {
    textAlign: "center",
    margin: "16px 0",
    color: C.goldDim,
    fontSize: 12,
    letterSpacing: 2,
  },
  foot: {
    color: C.parchDim,
    fontSize: 12.5,
    marginTop: 16,
    lineHeight: 1.5,
    fontStyle: "italic",
  },

  /* Buttons */
  btnGold: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "12px 16px",
    borderRadius: 9,
    border: "none",
    fontSize: 16,
    color: "#2a1c06",
    background: `linear-gradient(180deg, ${C.gold}, ${C.goldDim})`,
    boxShadow: "0 4px 14px rgba(227,169,60,.3)",
    fontFamily: serifDisplay,
    letterSpacing: 0.5,
  },
  btnGhost: {
    width: "100%",
    padding: "11px 16px",
    borderRadius: 9,
    fontSize: 16,
    border: `1px solid ${C.goldDim}`,
    color: C.gold,
    background: "transparent",
    fontFamily: serifDisplay,
  },
  error: { color: C.evil, fontSize: 13.5, marginTop: 12, textAlign: "center" },

  /* Panels */
  panelWrap: { animation: "fadeUp .35s ease" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    marginBottom: 12,
    borderBottom: `1px solid ${C.line}`,
  },
  headerL: { display: "flex", alignItems: "center", gap: 8 },
  headerTitle: {
    fontFamily: serifDisplay,
    fontSize: 20,
    color: C.gold,
    letterSpacing: 1,
  },
  headerName: { color: C.parchDim, fontSize: 14 },

  /* Lobby */
  codeBanner: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    justifyContent: "center",
    background: C.panel,
    border: `1px solid ${C.goldDim}`,
    borderRadius: 12,
    padding: "12px 16px",
    marginBottom: 16,
  },
  codeLabel: { fontSize: 11, letterSpacing: 2, color: C.parchDim },
  codeBig: {
    fontFamily: serifDisplay,
    fontSize: 30,
    color: C.gold,
    letterSpacing: 8,
  },
  copyBtn: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    color: C.parchDim,
    background: "transparent",
    border: `1px solid ${C.line}`,
    borderRadius: 7,
    padding: "5px 9px",
  },
  h2: {
    fontFamily: serifDisplay,
    fontSize: 17,
    color: C.gold,
    display: "flex",
    alignItems: "center",
    gap: 7,
    margin: "18px 0 10px",
  },
  playerGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
  playerChip: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "7px 12px",
    borderRadius: 20,
    background: C.panel,
    border: `1px solid ${C.line}`,
    fontSize: 14,
    color: C.parch,
  },
  playerChipMe: { borderColor: C.goldDim, background: "rgba(227,169,60,.1)" },
  optGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 },
  optBtn: {
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid",
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  optDesc: { fontSize: 12, color: C.parchDim },
  note: {
    fontSize: 12.5,
    color: C.parchDim,
    margin: "10px 0 0",
    fontStyle: "italic",
  },
  noteDim: { fontSize: 12, color: C.goldDim, margin: "8px 0 0" },
  waiting: {
    textAlign: "center",
    color: C.parchDim,
    fontStyle: "italic",
    padding: "22px 0",
    fontSize: 15,
  },
  leave: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    margin: "22px auto 0",
    background: "transparent",
    border: "none",
    color: C.parchDim,
    fontSize: 13,
  },

  /* Role */
  roleCard: {
    borderRadius: 14,
    border: "1.5px solid",
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,.5)",
  },
  roleTeam: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: C.parchDim,
  },
  roleName: { fontFamily: serifDisplay, fontSize: 26, color: C.parch },
  roleDesc: {
    fontSize: 15,
    lineHeight: 1.55,
    color: C.parch,
    marginTop: 12,
    opacity: 0.92,
  },
  knowBox: {
    marginTop: 16,
    paddingTop: 14,
    borderTop: "1px solid rgba(255,255,255,.08)",
  },
  knowLabel: {
    fontSize: 13,
    color: C.gold,
    marginBottom: 8,
    fontStyle: "italic",
  },
  knowNames: { display: "flex", flexWrap: "wrap", gap: 8 },
  knowName: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "6px 11px",
    borderRadius: 18,
    background: "rgba(0,0,0,.3)",
    border: `1px solid ${C.goldDim}`,
    fontSize: 14,
  },
  knowEmpty: { color: C.parchDim, fontSize: 13, fontStyle: "italic" },

  /* ================= CIRCULAR TABLE ================= */
  tableContainer: {
    position: "relative",
    width: "100%",
    margin: "10px auto 16px",
  },
  tableCenter: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    zIndex: 1,
  },
  centerPhase: { textAlign: "center" },
  phaseText: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 13,
    color: C.gold,
    fontStyle: "italic",
  },

  /* Seat nodes */
  seatNode: {
    position: "absolute",
    width: 64,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    zIndex: 2,
    transition: "transform .15s ease",
  },
  avatarRing: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    border: "2.5px solid",
    overflow: "hidden",
    position: "relative",
    background: C.panel2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "border-color .2s ease, box-shadow .2s ease",
  },
  avatarVideo: { width: "100%", height: "100%", objectFit: "cover" },
  avatarLetter: { fontFamily: serifDisplay, fontSize: 22, color: C.gold },
  micBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: "50%",
    background: C.ink2,
    border: `1px solid ${C.line}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  crownBadge: {
    position: "absolute",
    top: -2,
    left: "50%",
    transform: "translateX(-50%)",
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: C.ink2,
    border: `1px solid ${C.goldDim}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  checkBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: "50%",
    background: C.gold,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  seatName: {
    fontSize: 11,
    textAlign: "center",
    fontWeight: 500,
    whiteSpace: "nowrap",
    maxWidth: 64,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  youTag: { fontSize: 9, color: C.goldDim, marginLeft: 3 },

  /* Action area below table */
  actionArea: { marginTop: 4 },
  actionCard: {
    background: C.panel,
    border: `1px solid ${C.goldDim}`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    boxShadow: "0 8px 24px rgba(0,0,0,.4)",
  },
  actionTitle: {
    fontFamily: serifDisplay,
    fontSize: 17,
    color: C.gold,
    marginBottom: 12,
  },
  waitCard: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: C.parchDim,
    fontSize: 14,
    padding: "10px 0",
  },

  seatGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  seat: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 12px",
    borderRadius: 9,
    border: `1px solid ${C.line}`,
    background: C.ink2,
    color: C.parch,
    fontSize: 14.5,
  },
  seatSel: {
    borderColor: C.gold,
    background: `linear-gradient(180deg, ${C.gold}, ${C.goldDim})`,
    color: C.ink,
    fontWeight: 600,
  },
  teamPills: { display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 },
  teamPill: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "6px 12px",
    borderRadius: 18,
    background: C.ink2,
    border: `1px solid ${C.goldDim}`,
    fontSize: 14,
  },
  voteBtns: { display: "flex", gap: 10 },
  approve: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "13px",
    borderRadius: 10,
    border: `1px solid ${C.good}`,
    background: "rgba(63,159,142,.16)",
    color: C.good,
    fontSize: 16,
    fontWeight: 600,
  },
  reject: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "13px",
    borderRadius: 10,
    border: `1px solid ${C.evil}`,
    background: "rgba(193,74,63,.16)",
    color: C.evil,
    fontSize: 16,
    fontWeight: 600,
  },

  /* Quest tracker */
  tracker: {
    display: "flex",
    gap: 6,
    justifyContent: "center",
    marginBottom: 8,
  },
  questOrb: {
    position: "relative",
    width: 42,
    height: 46,
    borderRadius: 10,
    border: "2px solid",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  questNum: { fontFamily: serifDisplay, fontSize: 16, color: C.parch },
  questSub: { fontSize: 9, color: C.parchDim, letterSpacing: 1 },
  orbMark: { position: "absolute", top: 3, right: 3 },
  voteTrack: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    justifyContent: "center",
    marginBottom: 6,
  },
  voteTrackLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: C.parchDim,
    textTransform: "uppercase",
  },
  pip: {
    width: 11,
    height: 11,
    borderRadius: "50%",
    border: "2px solid",
    display: "inline-block",
  },
  dangerText: { color: C.evil, fontSize: 11, fontWeight: 700, marginLeft: 2 },

  /* Banners */
  banner: {
    background: C.ink2,
    border: "1px solid",
    borderRadius: 10,
    padding: "10px 14px",
    marginBottom: 10,
  },
  bannerHead: {
    fontFamily: serifDisplay,
    fontSize: 14,
    color: C.gold,
    marginBottom: 5,
  },
  bannerRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    color: C.parch,
    marginTop: 3,
  },

  /* Secret role peek */
  secretWrap: { textAlign: "center", marginTop: 14 },
  secretBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: 20,
    border: `1px solid ${C.line}`,
    background: C.panel,
    color: C.parchDim,
    fontSize: 13,
  },
  secretCard: {
    marginTop: 8,
    display: "inline-block",
    padding: "8px 16px",
    borderRadius: 10,
    border: "1px solid",
    background: C.ink2,
  },

  /* End screen */
  endBanner: {
    borderRadius: 14,
    border: "2px solid",
    padding: 22,
    textAlign: "center",
    marginBottom: 16,
    boxShadow: "0 10px 34px rgba(0,0,0,.55)",
  },
  endTitle: {
    fontFamily: serifDisplay,
    fontSize: 30,
    color: C.parch,
    margin: "8px 0 6px",
  },
  endReason: {
    fontSize: 15,
    lineHeight: 1.5,
    color: C.parch,
    opacity: 0.9,
    margin: 0,
  },
  revealGrid: { display: "flex", flexDirection: "column", gap: 7 },
  revealRow: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "10px 14px",
    borderRadius: 9,
    border: "1px solid",
    fontSize: 14.5,
  },
  daggerTag: { fontSize: 11, color: C.evil, marginLeft: 8 },

  /* Voice bar */
  voiceBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    background: C.panel,
    border: `1px solid ${C.line}`,
    borderRadius: 10,
    padding: "7px 12px",
    marginBottom: 12,
  },
  voiceLeft: { display: "flex", alignItems: "center", gap: 6, minWidth: 0 },
  voiceTitle: {
    fontFamily: serifDisplay,
    fontSize: 14,
    color: C.gold,
    letterSpacing: 0.5,
  },
  voiceHint: { fontSize: 11, color: C.parchDim, fontStyle: "italic" },
  voiceRight: { display: "flex", alignItems: "center", gap: 5 },
  voiceJoin: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "6px 12px",
    borderRadius: 18,
    border: `1px solid ${C.good}`,
    background: "rgba(63,159,142,.14)",
    color: C.good,
    fontSize: 13,
    fontWeight: 600,
  },
  voiceIconBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: `1px solid ${C.line}`,
    background: C.ink2,
  },
  voiceLeaveBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: `1px solid ${C.evilDk}`,
    background: "rgba(193,74,63,.14)",
  },
};
