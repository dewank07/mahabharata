import { useState, useEffect, type CSSProperties } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import { useVoice } from "./useVoice";
import { RevealCeremony } from "./RevealCeremony";
import { Table, type TableActions } from "./table";
import emblemSrc from "./assets/emblem.png";
import { THEMES, THEME_LIST } from "../convex/themes";
import { DISCUSS_MS, SELECT_MS, isPremiumTheme } from "../convex/logic";
import {
  Crown,
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

/** Starting allegiance. A Lancelot's CURRENT side comes from the server (`me.team`). */
const ROLE_TEAM: Record<Role, "good" | "evil"> = {
  merlin: "good",
  percival: "good",
  guinevere: "good",
  tristan: "good",
  isolde: "good",
  lancelot_good: "good",
  servant: "good",
  assassin: "evil",
  morgana: "evil",
  mordred: "evil",
  oberon: "evil",
  lancelot_evil: "evil",
  minion: "evil",
};

/** Which existing portrait illustration stands in for each expansion role. */
const PORTRAIT_ALIAS: Record<string, string> = {
  guinevere: "guinevere",
  tristan: "lovers",
  isolde: "lovers",
  lancelot_good: "lancelot",
  lancelot_evil: "lancelot",
};

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

/** Theme-aware names for the expansions, falling back to the Avalon wording. */
function expName(theme: any, kind: "lady" | "excalibur" | "loyalty" | "plots") {
  const fallback = {
    lady: "Lady of the Lake",
    excalibur: "Excalibur",
    loyalty: "Loyalty Cards",
    plots: "Plot Cards",
  }[kind];
  return theme?.expansions?.[kind]?.name ?? fallback;
}

function plotName(theme: any, card: string) {
  return theme?.expansions?.plots?.cards?.[card] ?? PLOT_LABEL[card] ?? card;
}

const PHASE_LABEL: Record<string, string> = {
  plot: "Deal the Plot Cards",
  propose: "Propose War Party",
  vote: "Vote on War Party",
  kingReturns: "The King Returns?",
  quest: "Battle Quest",
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

function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function ProposeClock({
  discussEndsAt,
  selectEndsAt,
  isLeader,
}: {
  discussEndsAt: number | null;
  selectEndsAt: number | null;
  isLeader: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  if (!discussEndsAt || !selectEndsAt) return null;
  const inDiscuss = now < discussEndsAt;
  const remaining = inDiscuss ? discussEndsAt - now : selectEndsAt - now;
  const expired = now >= selectEndsAt;
  const discussStart = discussEndsAt - DISCUSS_MS;
  const discussFrac = Math.min(
    1,
    Math.max(0, (Math.min(now, discussEndsAt) - discussStart) / DISCUSS_MS),
  );
  const selectFrac = now <= discussEndsAt
    ? 0
    : Math.min(1, Math.max(0, (now - discussEndsAt) / SELECT_MS));
  const label = expired
    ? "Time’s up — locking a party…"
    : inDiscuss
      ? "Discussion"
      : "Council selection";
  const hint = expired
    ? "The table will send a party automatically."
    : inDiscuss
      ? isLeader
        ? "Talk it through. You may lock a party early."
        : "3 minutes to confer. The leader may still lock early."
      : isLeader
        ? "Last minute — lock the war party."
        : "Last minute for the leader to choose.";

  return (
    <div className={`war-timer${expired ? " war-timer--late" : inDiscuss ? "" : " war-timer--select"}`}>
      <div className="war-timer__row">
        <Timer size={14} />
        <span className="war-timer__label">{label}</span>
        <span className="war-timer__clock">{expired ? "0:00" : fmtClock(remaining)}</span>
      </div>
      <div className="war-timer__track" aria-hidden>
        <div className="war-timer__lane">
          <span style={{ width: `${discussFrac * 100}%` }} />
        </div>
        <div className="war-timer__lane war-timer__lane--select">
          <span style={{ width: `${selectFrac * 100}%` }} />
        </div>
      </div>
      <p className="war-timer__hint">{hint}</p>
    </div>
  );
}

function getRoleMeta(role: string, theme: any) {
  const roles = Array.isArray(theme?.roles)
    ? theme.roles
    : THEMES[theme?.id]?.roles ?? [];
  return (
    roles.find((r: any) => r.id === role) ?? {
      name: role,
      team: ROLE_TEAM[role as Role] ?? "good",
      desc: "",
      knowledgeLabel: "",
    }
  );
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
      viewBox="0 0 100 100"
      fill="none"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
    >
      <circle cx="50" cy="50" r="31" />
      <circle cx="50" cy="50" r="9" fill={color} stroke="none" />
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
            r="1.5"
            fill={color}
            stroke="none"
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
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" />
      </svg>
    );
  }
  if (icon === "ankh") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="50" cy="32" r="15" fill="none" />
        <path d="M50 47v40M32 60h36" />
      </svg>
    );
  }
  if (icon === "lightning") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="none" />
      </svg>
    );
  }
  if (icon === "fort") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M15 80V45l10-10h10V22h15v13h10V22h15v13h10l10 10v35H15z"
          fill="none"
        />
        <path d="M40 80V62c0-5 5-10 10-10s10 5 10 10v18" fill="none" />
      </svg>
    );
  }
  return <Chakra size={size} color={color} />;
}

function ThemePickRow({
  selectedId,
  onSelect,
  disabled,
  lockPremium,
}: {
  selectedId: string;
  onSelect?: (id: string) => void;
  disabled?: boolean;
  /** Grey out and block the paid worlds. */
  lockPremium?: boolean;
}) {
  const extra = THEMES[selectedId];
  const items = THEME_LIST.some((t) => t.id === selectedId)
    ? THEME_LIST
    : extra
      ? [
          {
            id: extra.id,
            name: extra.name,
            tagline: extra.tagline,
            crestIcon: extra.crestIcon,
            goodTeamName: extra.goodTeamName,
            evilTeamName: extra.evilTeamName,
          },
          ...THEME_LIST,
        ]
      : THEME_LIST;

  return (
    <div className="theme-pick">
      {items.map((t) => {
        const on = t.id === selectedId;
        // Never lock the world already in play, so an existing room stays usable.
        const locked = Boolean(lockPremium) && isPremiumTheme(t.id) && !on;
        return (
          <button
            key={t.id}
            type="button"
            disabled={disabled || locked}
            title={locked ? `${t.name} — premium world` : t.tagline}
            className={`theme-pick__card${on ? " is-on" : ""}`}
            style={locked ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
            onClick={() => onSelect?.(t.id)}
          >
            <span className="theme-pick__crest">
              <CrestIcon
                icon={t.crestIcon}
                size={22}
                color={on ? "var(--theme-gold)" : "var(--theme-parch-dim)"}
              />
            </span>
            <span className="theme-pick__copy">
              <strong>{t.name}</strong>
              <em>
                {locked ? (
                  <>
                    <Lock size={10} /> Premium world
                  </>
                ) : (
                  <>
                    {t.goodTeamName} vs {t.evilTeamName}
                  </>
                )}
              </em>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ====================== Role Portrait SVG Illustrations =================== */
function RolePortrait({ role, good, color, dim }: { role: string; good: boolean; color: string; dim: string }) {
  const primary = color;
  const secondary = good ? "rgba(63,220,180,0.25)" : "rgba(220,80,60,0.25)";
  const glow = good ? "rgba(63,220,180,0.6)" : "rgba(220,80,60,0.6)";
  role = PORTRAIT_ALIAS[role] ?? role;

  // Guinevere / Kunti / Isis / Hera / Jijabai — crowned watcher who marks the Lancelots
  if (role === "guinevere") return (
    <svg viewBox="0 0 200 260" width="100%" height="100%" fill="none">
      <circle cx="100" cy="74" r="44" fill={secondary} />
      {/* Tall queen's crown */}
      <path d="M74 48 L80 26 L90 44 L100 20 L110 44 L120 26 L126 48Z" fill={primary} opacity="0.9" />
      <circle cx="100" cy="20" r="4" fill={primary} />
      {/* Veiled head */}
      <ellipse cx="100" cy="76" rx="29" ry="33" fill={secondary} stroke={primary} strokeWidth="2" />
      <path d="M71 76 Q71 116 78 140" stroke={primary} strokeWidth="2" fill="none" opacity="0.7" />
      <path d="M129 76 Q129 116 122 140" stroke={primary} strokeWidth="2" fill="none" opacity="0.7" />
      <ellipse cx="91" cy="76" rx="5" ry="3.5" fill={primary} opacity="0.9" />
      <ellipse cx="109" cy="76" rx="5" ry="3.5" fill={primary} opacity="0.9" />
      {/* Gown */}
      <path d="M70 110 Q85 124 100 121 Q115 124 130 110 L142 228 Q100 236 58 228Z" fill={secondary} stroke={primary} strokeWidth="1.5" />
      {/* Two marked figures at her feet — the Lancelots, one bright, one dark */}
      <circle cx="80" cy="186" r="9" fill={primary} opacity="0.85" />
      <circle cx="120" cy="186" r="9" fill="rgba(0,0,0,0.45)" stroke={primary} strokeWidth="1.5" />
      <path d="M80 186 L120 186" stroke={primary} strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
      <ellipse cx="100" cy="248" rx="50" ry="8" fill={glow} opacity="0.3" />
    </svg>
  );

  // Tristan & Isolde / Abhimanyu & Uttara / Geb & Nut / Eros & Psyche — the lovers
  if (role === "lovers") return (
    <svg viewBox="0 0 200 260" width="100%" height="100%" fill="none">
      <circle cx="100" cy="96" r="54" fill={secondary} opacity="0.5" />
      {/* Two heads leaning together */}
      <ellipse cx="74" cy="76" rx="24" ry="27" fill={secondary} stroke={primary} strokeWidth="2" />
      <ellipse cx="126" cy="76" rx="24" ry="27" fill={secondary} stroke={primary} strokeWidth="2" />
      <ellipse cx="68" cy="76" rx="4" ry="3" fill={primary} opacity="0.9" />
      <ellipse cx="82" cy="76" rx="4" ry="3" fill={primary} opacity="0.9" />
      <ellipse cx="118" cy="76" rx="4" ry="3" fill={primary} opacity="0.9" />
      <ellipse cx="132" cy="76" rx="4" ry="3" fill={primary} opacity="0.9" />
      {/* Heart between them */}
      <path d="M100 122 C92 112 80 116 80 126 C80 136 100 148 100 148 C100 148 120 136 120 126 C120 116 108 112 100 122Z"
        fill={primary} opacity="0.75" />
      {/* Joined cloaks */}
      <path d="M50 104 Q62 118 74 116 L86 132 L100 150 L114 132 L126 116 Q138 118 150 104 L156 230 Q100 240 44 230Z"
        fill={secondary} stroke={primary} strokeWidth="1.5" />
      {/* Clasped hands */}
      <path d="M86 186 Q100 178 114 186" stroke={primary} strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx="100" cy="248" rx="52" ry="8" fill={glow} opacity="0.3" />
    </svg>
  );

  // The Lancelots — one knight, a cloak split between two loyalties
  if (role === "lancelot") return (
    <svg viewBox="0 0 200 260" width="100%" height="100%" fill="none">
      <circle cx="100" cy="72" r="44" fill={secondary} />
      {/* Great helm with plume */}
      <path d="M72 80 Q72 36 100 32 Q128 36 128 80Z" fill={secondary} stroke={primary} strokeWidth="2.5" />
      <path d="M100 32 Q112 16 126 14" stroke={primary} strokeWidth="3" strokeLinecap="round" fill="none" />
      <rect x="80" y="66" width="40" height="9" rx="3" fill="rgba(0,0,0,0.45)" stroke={primary} strokeWidth="1.5" />
      <ellipse cx="90" cy="70.5" rx="4" ry="3" fill={primary} />
      <ellipse cx="110" cy="70.5" rx="4" ry="3" fill={primary} />
      {/* Body: left half lit, right half shadowed — loyalty in the balance */}
      <path d="M72 106 Q86 120 100 118 L100 226 Q84 228 68 222Z" fill={secondary} stroke={primary} strokeWidth="1.5" />
      <path d="M128 106 Q114 120 100 118 L100 226 Q116 228 132 222Z" fill="rgba(0,0,0,0.42)" stroke={primary} strokeWidth="1.5" />
      {/* Dividing line straight down the middle */}
      <line x1="100" y1="112" x2="100" y2="226" stroke={primary} strokeWidth="2" strokeDasharray="5 4" />
      {/* Sword held point-down, neutral */}
      <line x1="150" y1="86" x2="150" y2="216" stroke={primary} strokeWidth="3" strokeLinecap="round" />
      <path d="M138 100 L162 100" stroke={primary} strokeWidth="4" strokeLinecap="round" />
      <polygon points="144,216 156,216 150,234" fill={primary} />
      <ellipse cx="100" cy="248" rx="50" ry="8" fill={glow} opacity="0.3" />
    </svg>
  );


  // Merlin / Zeus / Krishna / Ra / Shivaji — Wise, radiant divine guide with crown/halo
  if (role === "merlin") return (
    <svg viewBox="0 0 200 260" width="100%" height="100%" fill="none">
      {/* Radiant halo */}
      <circle cx="100" cy="72" r="48" fill={secondary} />
      {[0,30,60,90,120,150,180,210,240,270,300,330].map(a => (
        <line key={a} x1="100" y1="72"
          x2={100 + 56*Math.cos(a*Math.PI/180)}
          y2={72 + 56*Math.sin(a*Math.PI/180)}
          stroke={primary} strokeWidth="1.5" strokeOpacity="0.6" />
      ))}
      {/* Head */}
      <ellipse cx="100" cy="72" rx="30" ry="34" fill={secondary} stroke={primary} strokeWidth="2" />
      {/* Crown */}
      <polygon points="70,50 76,38 82,50 88,36 94,50 100,35 106,50 112,36 118,50 124,38 130,50" fill={primary} opacity="0.9" />
      {/* Eyes glow */}
      <ellipse cx="91" cy="70" rx="5" ry="4" fill={primary} opacity="0.9" />
      <ellipse cx="109" cy="70" rx="5" ry="4" fill={primary} opacity="0.9" />
      {/* Beard */}
      <path d="M82 92 Q100 110 118 92" stroke={primary} strokeWidth="2" fill="none" />
      {/* Robe body */}
      <path d="M65 106 Q50 140 48 200 Q74 188 100 195 Q126 188 152 200 Q150 140 135 106 Q118 118 100 115 Q82 118 65 106Z" fill={secondary} stroke={primary} strokeWidth="1.5" />
      {/* Orb in hand */}
      <circle cx="100" cy="165" r="18" fill="none" stroke={primary} strokeWidth="2" />
      <circle cx="100" cy="165" r="10" fill={primary} opacity="0.5" />
      <circle cx="100" cy="165" r="4" fill={primary} />
      {/* Arms holding orb */}
      <path d="M65 130 Q82 155 82 165" stroke={primary} strokeWidth="3" strokeLinecap="round" />
      <path d="M135 130 Q118 155 118 165" stroke={primary} strokeWidth="3" strokeLinecap="round" />
      {/* Base glow */}
      <ellipse cx="100" cy="248" rx="50" ry="8" fill={glow} opacity="0.3" />
    </svg>
  );

  // Percival / Arjuna / Athena / Horus / Baji Prabhu — Noble Champion with shield & spear
  if (role === "percival") return (
    <svg viewBox="0 0 200 260" width="100%" height="100%" fill="none">
      {/* Aura */}
      <circle cx="100" cy="70" r="42" fill={secondary} />
      {/* Helmet */}
      <path d="M72 78 Q72 38 100 35 Q128 38 128 78Z" fill={secondary} stroke={primary} strokeWidth="2" />
      <path d="M72 78 L66 84 L70 70" stroke={primary} strokeWidth="2" />
      <path d="M128 78 L134 84 L130 70" stroke={primary} strokeWidth="2" />
      {/* Visor */}
      <path d="M82 65 L118 65" stroke={primary} strokeWidth="2" />
      <ellipse cx="90" cy="72" rx="4" ry="3" fill={primary} opacity="0.8" />
      <ellipse cx="110" cy="72" rx="4" ry="3" fill={primary} opacity="0.8" />
      {/* Shield */}
      <path d="M50 110 L50 170 Q50 200 75 210 L75 110Z" fill={secondary} stroke={primary} strokeWidth="2" />
      <path d="M50 140 L75 140" stroke={primary} strokeWidth="1.5" />
      <circle cx="62" cy="155" r="8" fill="none" stroke={primary} strokeWidth="1.5" />
      {/* Spear */}
      <line x1="140" y1="50" x2="140" y2="240" stroke={primary} strokeWidth="3" strokeLinecap="round" />
      <polygon points="132,50 148,50 140,30" fill={primary} />
      {/* Body */}
      <path d="M75 108 Q88 118 100 116 Q112 118 125 108 L130 220 Q100 228 70 220Z" fill={secondary} stroke={primary} strokeWidth="1.5" />
      <ellipse cx="100" cy="248" rx="48" ry="8" fill={glow} opacity="0.3" />
    </svg>
  );

  // Servant / Loyal Knight / Guardian / Hero / Mavala — Steadfast soldier with sword
  if (role === "servant") return (
    <svg viewBox="0 0 200 260" width="100%" height="100%" fill="none">
      <circle cx="100" cy="70" r="38" fill={secondary} />
      {/* Head plain */}
      <ellipse cx="100" cy="70" rx="28" ry="32" fill={secondary} stroke={primary} strokeWidth="2" />
      {/* Simple headband */}
      <path d="M72 62 Q100 56 128 62" stroke={primary} strokeWidth="2.5" />
      <ellipse cx="91" cy="72" rx="4" ry="3.5" fill={primary} opacity="0.7" />
      <ellipse cx="109" cy="72" rx="4" ry="3.5" fill={primary} opacity="0.7" />
      {/* Sword raised */}
      <line x1="130" y1="30" x2="130" y2="160" stroke={primary} strokeWidth="3" />
      <polygon points="122,30 138,30 130,10" fill={primary} />
      <path d="M118 125 L142 125" stroke={primary} strokeWidth="4" strokeLinecap="round" />
      {/* Body with armor plates */}
      <path d="M72 100 Q86 114 100 112 Q114 114 128 100 L132 220 Q100 228 68 220Z" fill={secondary} stroke={primary} strokeWidth="1.5" />
      <path d="M88 125 Q100 135 112 125" stroke={primary} strokeWidth="1.5" fill="none" />
      <path d="M85 148 Q100 158 115 148" stroke={primary} strokeWidth="1.5" fill="none" />
      <ellipse cx="100" cy="248" rx="46" ry="8" fill={glow} opacity="0.3" />
    </svg>
  );

  // Assassin / Ashwatthama / Set / Hades / Siddi Johar — Hooded, daggers, menacing
  if (role === "assassin") return (
    <svg viewBox="0 0 200 260" width="100%" height="100%" fill="none">
      <circle cx="100" cy="72" r="44" fill={secondary} />
      {/* Hood */}
      <path d="M56 72 Q56 28 100 24 Q144 28 144 72 L140 90 Q120 82 100 84 Q80 82 60 90Z" fill={secondary} stroke={primary} strokeWidth="2" />
      {/* Shadow face — only eyes visible */}
      <ellipse cx="100" cy="74" rx="28" ry="30" fill="rgba(0,0,0,0.5)" />
      <ellipse cx="89" cy="72" rx="6" ry="4" fill={primary} />
      <ellipse cx="111" cy="72" rx="6" ry="4" fill={primary} />
      {/* Daggers crossed */}
      <line x1="62" y1="110" x2="92" y2="160" stroke={primary} strokeWidth="3" strokeLinecap="round" />
      <polygon points="56,104 68,104 62,88" fill={primary} />
      <line x1="138" y1="110" x2="108" y2="160" stroke={primary} strokeWidth="3" strokeLinecap="round" />
      <polygon points="132,104 144,104 138,88" fill={primary} />
      {/* Dark robe */}
      <path d="M60 98 Q78 115 100 113 Q122 115 140 98 L148 230 Q100 238 52 230Z" fill={secondary} stroke={primary} strokeWidth="1.5" />
      {/* Red eye slit glow */}
      <rect x="82" y="68" width="36" height="8" rx="4" fill={primary} opacity="0.3" />
      <ellipse cx="100" cy="248" rx="50" ry="8" fill={glow} opacity="0.3" />
    </svg>
  );

  // Morgana / Shakuni / Anubis / Hecate / Shaista Khan — Illusionist, staff, mystic
  if (role === "morgana") return (
    <svg viewBox="0 0 200 260" width="100%" height="100%" fill="none">
      <circle cx="100" cy="72" r="44" fill={secondary} />
      {/* Flowing hair */}
      <path d="M70 56 Q60 80 58 120" stroke={primary} strokeWidth="3" fill="none" />
      <path d="M130 56 Q140 80 142 120" stroke={primary} strokeWidth="3" fill="none" />
      {/* Head */}
      <ellipse cx="100" cy="72" rx="30" ry="34" fill={secondary} stroke={primary} strokeWidth="2" />
      {/* Horned headdress */}
      <path d="M74 46 Q66 28 72 20" stroke={primary} strokeWidth="3" strokeLinecap="round" />
      <path d="M126 46 Q134 28 128 20" stroke={primary} strokeWidth="3" strokeLinecap="round" />
      {/* Slit eyes */}
      <ellipse cx="90" cy="71" rx="6" ry="3" fill={primary} opacity="0.9" />
      <ellipse cx="110" cy="71" rx="6" ry="3" fill={primary} opacity="0.9" />
      {/* Magic orb on staff */}
      <line x1="148" y1="50" x2="120" y2="180" stroke={primary} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="150" cy="46" r="12" fill="none" stroke={primary} strokeWidth="2" />
      <circle cx="150" cy="46" r="6" fill={primary} opacity="0.6" />
      {/* Robe with swirls */}
      <path d="M68 106 Q84 118 100 115 Q116 118 132 106 L138 225 Q100 232 62 225Z" fill={secondary} stroke={primary} strokeWidth="1.5" />
      <path d="M80 145 Q90 155 100 148 Q110 155 120 148" stroke={primary} strokeWidth="1.5" fill="none" />
      <ellipse cx="100" cy="248" rx="48" ry="8" fill={glow} opacity="0.3" />
    </svg>
  );

  // Mordred / Duryodhana / Sobek / Ares / Aurangzeb — Dark armored king, crown of thorns
  if (role === "mordred") return (
    <svg viewBox="0 0 200 260" width="100%" height="100%" fill="none">
      <circle cx="100" cy="72" r="46" fill={secondary} />
      {/* Spiked crown */}
      <polygon points="70,52 75,38 80,52 86,35 92,52 100,33 108,52 114,35 120,52 125,38 130,52" fill={primary} />
      {/* Armored head */}
      <ellipse cx="100" cy="72" rx="30" ry="34" fill={secondary} stroke={primary} strokeWidth="2.5" />
      {/* Battle visor */}
      <rect x="80" y="62" width="40" height="12" rx="3" fill="rgba(0,0,0,0.4)" stroke={primary} strokeWidth="1.5" />
      <ellipse cx="91" cy="68" rx="4.5" ry="3.5" fill={primary} />
      <ellipse cx="109" cy="68" rx="4.5" ry="3.5" fill={primary} />
      {/* Massive pauldrons */}
      <ellipse cx="58" cy="110" rx="20" ry="12" fill={secondary} stroke={primary} strokeWidth="2" />
      <ellipse cx="142" cy="110" rx="20" ry="12" fill={secondary} stroke={primary} strokeWidth="2" />
      {/* Spiked armor body */}
      <path d="M70 105 Q84 118 100 116 Q116 118 130 105 L138 228 Q100 236 62 228Z" fill={secondary} stroke={primary} strokeWidth="2" />
      {/* Armor ridges */}
      <path d="M88 132 L100 140 L112 132" stroke={primary} strokeWidth="2" fill="none" />
      <path d="M88 155 L100 163 L112 155" stroke={primary} strokeWidth="2" fill="none" />
      {/* Raised fist */}
      <path d="M56 112 L50 140 L56 148" stroke={primary} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="100" cy="248" rx="52" ry="8" fill={glow} opacity="0.3" />
    </svg>
  );

  // Oberon / Jayadratha / Apep / Typhon / Ganoji Shirke — Shadow rogue, cloaked loner
  if (role === "oberon") return (
    <svg viewBox="0 0 200 260" width="100%" height="100%" fill="none">
      {/* Darkness aura */}
      <circle cx="100" cy="80" r="50" fill={secondary} opacity="0.4" />
      <circle cx="100" cy="80" r="35" fill={secondary} opacity="0.3" />
      {/* Full cloak body */}
      <path d="M52 80 Q60 30 100 26 Q140 30 148 80 L155 240 Q100 248 45 240Z" fill={secondary} stroke={primary} strokeWidth="1.5" />
      {/* Just one glowing eye */}
      <ellipse cx="100" cy="74" rx="6" ry="4" fill={primary} />
      <circle cx="100" cy="74" r="8" fill="none" stroke={primary} strokeWidth="1" opacity="0.6" />
      {/* Ghostly hands */}
      <path d="M58 150 L50 168 M52 155 L46 170 M65 152 L60 172" stroke={primary} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <path d="M142 150 L150 168 M148 155 L154 170 M135 152 L140 172" stroke={primary} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      {/* Shadow tendrils at base */}
      <path d="M60 235 Q80 220 100 230 Q120 220 140 235" stroke={primary} strokeWidth="1.5" fill="none" opacity="0.6" />
      <ellipse cx="100" cy="248" rx="52" ry="8" fill={glow} opacity="0.3" />
    </svg>
  );

  // Minion / Kaurava Warrior / Agent of Chaos / Shade / Adilshahi Spy — Generic foot soldier
  return (
    <svg viewBox="0 0 200 260" width="100%" height="100%" fill="none">
      <circle cx="100" cy="70" r="38" fill={secondary} />
      {/* Soldier helmet */}
      <path d="M72 75 Q72 40 100 37 Q128 40 128 75 L125 82 L75 82Z" fill={secondary} stroke={primary} strokeWidth="2" />
      <path d="M72 74 L62 80" stroke={primary} strokeWidth="2" />
      <path d="M128 74 L138 80" stroke={primary} strokeWidth="2" />
      <ellipse cx="91" cy="74" rx="4" ry="3" fill={primary} opacity="0.8" />
      <ellipse cx="109" cy="74" rx="4" ry="3" fill={primary} opacity="0.8" />
      {/* X mark — traitor symbol */}
      <path d="M85 88 L96 100 M107 88 L96 100" stroke={primary} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      {/* Soldier body */}
      <path d="M74 100 Q87 112 100 110 Q113 112 126 100 L130 218 Q100 226 70 218Z" fill={secondary} stroke={primary} strokeWidth="1.5" />
      <path d="M86 130 Q100 138 114 130" stroke={primary} strokeWidth="1.5" fill="none" />
      {/* Spear */}
      <line x1="145" y1="60" x2="145" y2="230" stroke={primary} strokeWidth="2.5" />
      <polygon points="138,60 152,60 145,42" fill={primary} />
      <ellipse cx="100" cy="248" rx="46" ry="8" fill={glow} opacity="0.3" />
    </svg>
  );
}

const hasLiveVideo = (s?: MediaStream | null) =>
  !!s && s.getVideoTracks().some((t) => t.readyState === "live");
const getThemeQuote = (id: string): string => {
  switch (id) {
    case "india":
      return "धर्मसंस्थापनार्थाय सम्भवामि युगे युगे";
    case "maratha":
      return "प्रतिपच्चन्द्रलेखेव वर्धिष्णुर्विश्ववन्दिता";
    case "egyptian":
      return "𓋹 𓍘 𓋴 — Life, Prosperity, Health";
    case "greek":
      return "Η ΤΑΝ Η ΕΠΙ ΤΑΣ — With your shield, or on it";
    case "medieval":
      return "HONI SOIT QUI MAL Y PENSE";
    default:
      return "";
  }
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

  useEffect(() => {
    const root = document.documentElement;
    const c = activeTheme.colors;
    root.dataset.realm = activeTheme.id;
    root.style.setProperty("--theme-ink", c.ink);
    root.style.setProperty("--theme-ink2", c.ink2);
    root.style.setProperty("--theme-gold", c.gold);
    document.body.style.backgroundColor = c.ink;
    return () => {
      delete root.dataset.realm;
      root.style.removeProperty("--theme-ink");
      root.style.removeProperty("--theme-ink2");
      root.style.removeProperty("--theme-gold");
      document.body.style.backgroundColor = "";
    };
  }, [activeTheme]);

  const getAccentGradient = (_id: string): string => activeTheme.colors.ink2;

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
    "--theme-scepter-bg-start": activeTheme.colors.ink2,
    "--theme-scepter-bg-end": activeTheme.colors.ink,
  } as CSSProperties;

  // Account + entitlement. Signing in is optional to play; it is what unlocks
  // the paid roles and boards, and what the admin console checks.
  const { signOut } = useAuthActions();
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
  const shellWide =
    !code ||
    (room != null && !["lobby", "reveal"].includes(room.phase));

  return (
    <div className="app-root" style={styleVariables} data-realm={activeTheme.id}>
      <div className={`app-shell${shellWide ? " app-shell--wide" : ""}`}>
        {!code && Home()}
        {code && room === undefined && (
          <div style={st.center}>
            <Loader2 size={28} style={{ ...st.spin, color: C.gold }} />
          </div>
        )}
        {code && room === null && NotFound()}
      </div>

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

    </div>
  );


  /* ------------------------------- screens ------------------------------ */
  function Home() {
    const nameParts = activeTheme.name.split(" ");
    const quote =
      activeTheme.devanagariLabel ?? getThemeQuote(activeTheme.id);

    return (
      <div className="home">
        <div className="home__brand">
          <div className="home__crest-wrap">
            <svg
              className="rotate-board"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }}
              viewBox="0 0 100 100"
            >
              <circle
                cx="50"
                cy="50"
                r="47"
                fill="none"
                stroke="color-mix(in srgb, var(--theme-gold) 35%, transparent)"
                strokeWidth="0.8"
                strokeDasharray="4 6"
              />
            </svg>
            <div className="home__crest">
              <CrestIcon
                icon={activeTheme.crestIcon}
                size={30}
                color={C.gold}
              />
            </div>
          </div>

          <h1 className="home__title">
            <span style={{ display: "block" }}>{nameParts[0]}</span>
            {nameParts.length > 1 && (
              <span className="home__title-secondary">
                {nameParts.slice(1).join(" ")}
              </span>
            )}
          </h1>

          {quote ? <p className="home__quote">{quote}</p> : null}
          <p className="home__tagline">{activeTheme.tagline}</p>
        </div>

        <div className="home__action">
          <div className="home__form-card">
            <div className="home__tabs">
              <button
                type="button"
                className={`home__tab${activeTab === "create" ? " home__tab--active" : ""}`}
                onClick={() => setActiveTab("create")}
              >
                Create Council
              </button>
              <button
                type="button"
                className={`home__tab${activeTab === "join" ? " home__tab--active" : ""}`}
                onClick={() => setActiveTab("join")}
              >
                Join Council
              </button>
            </div>

            {activeTab === "create" ? (
              <>
                <label className="field-label">Your name</label>
                <div className="field-wrap">
                  <User size={16} color={C.parchDim} className="field-icon" />
                  <input
                    className="field-input"
                    value={name}
                    maxLength={16}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name — unique per warrior"
                    autoComplete="nickname"
                  />
                </div>
                <div className="home__hint">
                  Convene a new council to generate a unique room code and host
                  your warriors.
                </div>
                <button
                  type="button"
                  className="scepter-btn"
                  onClick={wrap(createRoom)}
                >
                  <Sparkles size={14} /> Convene a War Council
                </button>
              </>
            ) : (
              <>
                <label className="field-label">Your name</label>
                <div className="field-wrap">
                  <User size={16} color={C.parchDim} className="field-icon" />
                  <input
                    className="field-input"
                    value={name}
                    maxLength={16}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name — unique per warrior"
                    autoComplete="nickname"
                  />
                </div>
                <label className="field-label">Council code</label>
                <div className="field-wrap">
                  <Key size={16} color={C.parchDim} className="field-icon" />
                  <input
                    className="field-input"
                    style={{
                      letterSpacing: 6,
                      textTransform: "uppercase",
                      fontWeight: 700,
                    }}
                    value={codeInput}
                    maxLength={4}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    placeholder="ABCD"
                    autoCapitalize="characters"
                    autoCorrect="off"
                  />
                </div>
                <p className="home__hint">
                  Each tab needs a unique name. Reusing a name makes every
                  window show the same warrior and role.
                </p>
                <button
                  type="button"
                  className="scepter-btn"
                  onClick={wrap(joinRoom)}
                >
                  Join a War Council
                </button>
              </>
            )}
            {msg && <p style={st.error}>{msg}</p>}
          </div>
          <p className="home__foot">
            New to the war? Read the{" "}
            <a href="#/rules" style={{ color: "var(--theme-gold)" }}>
              laws of the Round Table
            </a>
            . Share this URL + the council code with your warriors.
          </p>
        </div>

        <div className="home__themes">
          <span className="home__themes-label">Choose a world</span>
          <ThemePickRow
            selectedId={localThemeId}
            onSelect={setLocalThemeId}
            lockPremium={!premium}
          />
        </div>
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

}
/* StyleTag styles moved to src/styles.css */

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
const serifDisplay = "'Cinzel', 'Rozha One', Georgia, serif";
const serifBody = "Inter, system-ui, sans-serif";

/* -------------------------------- styles -------------------------------- */
const st: Record<string, CSSProperties> = {
  root: {
    fontFamily: serifBody,
    minHeight: "100vh",
    color: C.parch,
    padding: "24px 16px",
    lineHeight: 1.5,
  },
  shell: { maxWidth: 580, margin: "0 auto" },
  center: { display: "flex", justifyContent: "center", padding: 60 },
  spin: { animation: "spin 1s linear infinite" },

  /* Home */
  home: {
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "center",
    gap: 40,
    maxWidth: 960,
    margin: "40px auto 0",
    animation: "fadeUp .4s cubic-bezier(0.16, 1, 0.3, 1)",
    position: "relative",
    flexWrap: "wrap",
    textAlign: "left",
  },
  homeLeft: {
    flex: "1 1 380px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    padding: "20px 0",
  },
  homeRight: {
    flex: "1 1 380px",
    maxWidth: 420,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    paddingTop: 20,
  },
  themeRow: {
    display: "flex",
    gap: 12,
    justifyContent: "flex-start",
    marginBottom: 20,
    marginTop: 6,
  },
  crest: {
    width: 84,
    height: 84,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `2px solid var(--theme-gold-dim)`,
    background: "color-mix(in srgb, var(--theme-panel) 60%, transparent)",
    boxShadow: "0 10px 30px rgba(0,0,0,.55), 0 0 16px rgba(227,169,60,.15)",
  },
  title: {
    fontFamily: serifDisplay,
    fontSize: 48,
    color: C.gold,
    margin: "12px 0 16px",
    letterSpacing: "1.5px",
    fontWeight: 700,
    lineHeight: 1.1,
    textShadow: "0 4px 15px rgba(0,0,0,0.95), 0 0 15px rgba(227,169,60,0.2)",
    textTransform: "uppercase",
  },
  deva: {
    fontFamily: serifBody,
    fontSize: 14.5,
    color: C.gold,
    letterSpacing: "2px",
    marginBottom: 20,
    opacity: 0.95,
    borderLeft: `3px solid var(--theme-gold)`,
    background: "rgba(0, 0, 0, 0.4)",
    padding: "10px 14px",
    borderRadius: "0 8px 8px 0",
    textShadow: "0 1px 3px rgba(0,0,0,0.9)",
    boxShadow: "inset 1px 0 0 rgba(255,255,255,0.03)",
    display: "flex",
    alignItems: "center",
    width: "100%",
    height: 48,
    boxSizing: "border-box",
  },
  subtitle: {
    color: C.parch,
    fontSize: 15.5,
    lineHeight: 1.6,
    margin: "0 0 20px",
    fontStyle: "italic",
    opacity: 0.95,
    textShadow: "0 2px 5px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    height: 52,
    boxSizing: "border-box",
  },
  themeSelectorBox: {
    background: "rgba(0, 0, 0, 0.35)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: `1.5px solid color-mix(in srgb, var(--theme-line) 30%, transparent)`,
    borderRadius: 16,
    padding: "18px 20px",
    marginTop: 20,
    boxShadow: "0 10px 25px rgba(0,0,0,.4)",
  },
  card: {
    background: "color-mix(in srgb, var(--theme-panel) 75%, transparent)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: `1.5px solid color-mix(in srgb, var(--theme-line) 40%, transparent)`,
    borderBottom: "none",
    borderRadius: "16px 16px 0 0",
    padding: 24,
    textAlign: "left",
    boxShadow:
      "0 20px 50px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,0.06)",
  },
  tabHeader: {
    display: "flex",
    borderBottom: `1.5px solid color-mix(in srgb, var(--theme-line) 40%, transparent)`,
    marginBottom: 20,
    borderRadius: "16px 16px 0 0",
    overflow: "hidden",
    background: "rgba(0,0,0,0.18)",
    margin: "-24px -24px 20px -24px",
  },
  tabBtn: {
    flex: 1,
    padding: "14px 16px",
    textAlign: "center",
    fontFamily: serifDisplay,
    fontSize: 13,
    letterSpacing: "1.5px",
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.25s ease",
    background: "transparent",
    border: "none",
    outline: "none",
  },
  label: {
    display: "block",
    fontSize: 11,
    letterSpacing: "1.8px",
    textTransform: "uppercase",
    color: C.parchDim,
    marginBottom: 8,
    fontWeight: 600,
  },
  input: {
    width: "100%",
    padding: "12px 15px",
    borderRadius: 10,
    border: `1px solid color-mix(in srgb, var(--theme-line) 60%, transparent)`,
    background: "color-mix(in srgb, var(--theme-ink) 80%, transparent)",
    color: C.parch,
    fontSize: 15,
    fontFamily: serifBody,
    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)",
  },
  or: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    margin: "18px 0",
    color: C.goldDim,
    fontSize: 11,
    letterSpacing: 3,
    textTransform: "uppercase",
    opacity: 0.75,
  },
  foot: {
    color: C.parchDim,
    fontSize: 12.5,
    lineHeight: 1.6,
    textAlign: "center",
    background: "color-mix(in srgb, var(--theme-panel) 85%, transparent)",
    border: `1.5px solid color-mix(in srgb, var(--theme-line) 40%, transparent)`,
    borderTop: "none",
    borderRadius: "0 0 16px 16px",
    padding: "16px 20px",
    marginTop: -2,
    boxShadow: "0 10px 25px rgba(0,0,0,.4)",
    textShadow: "0 1px 2px rgba(0,0,0,0.6)",
    fontStyle: "italic",
    opacity: 0.85,
  },

  /* Buttons */
  btnGold: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "13px 20px",
    borderRadius: 10,
    border: "none",
    fontSize: 15,
    color: "#201402",
    background: `linear-gradient(180deg, ${C.gold}, ${C.goldDim})`,
    boxShadow: "0 4px 16px rgba(227,169,60,.25)",
    fontFamily: serifDisplay,
    letterSpacing: "1px",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  btnGhost: {
    width: "100%",
    padding: "12px 20px",
    borderRadius: 10,
    fontSize: 15,
    border: `1.5px solid ${C.goldDim}`,
    color: C.gold,
    background: "transparent",
    fontFamily: serifDisplay,
    letterSpacing: "1px",
    fontWeight: 600,
    textTransform: "uppercase",
  },
  error: {
    color: C.evil,
    fontSize: 13.5,
    marginTop: 12,
    textAlign: "center",
    fontWeight: 500,
  },

  /* Panels */
  panelWrap: { animation: "fadeUp .4s cubic-bezier(0.16, 1, 0.3, 1)" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    marginBottom: 16,
    borderBottom: `1px solid color-mix(in srgb, var(--theme-line) 40%, transparent)`,
  },
  headerL: { display: "flex", alignItems: "center", gap: 8 },
  headerTitle: {
    fontFamily: serifDisplay,
    fontSize: 22,
    color: C.gold,
    letterSpacing: "0.8px",
    fontWeight: 600,
  },
  headerName: { color: C.parchDim, fontSize: 13.5, fontWeight: 500 },
  headerR: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  headerPremium: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: C.gold,
    border: `1px solid color-mix(in srgb, ${C.gold} 45%, transparent)`,
    background: `color-mix(in srgb, ${C.gold} 12%, transparent)`,
    borderRadius: 999,
    padding: "3px 9px",
  },
  headerLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    fontWeight: 700,
    color: C.parch,
    textDecoration: "none",
    border: `1px solid color-mix(in srgb, ${C.line} 70%, transparent)`,
    borderRadius: 999,
    padding: "4px 11px",
  },
  headerLinkBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    fontWeight: 700,
    color: C.parch,
    background: "transparent",
    cursor: "pointer",
    border: `1px solid color-mix(in srgb, ${C.line} 70%, transparent)`,
    borderRadius: 999,
    padding: "4px 11px",
  },

  /* Lobby */
  codeBanner: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    justifyContent: "center",
    background: "color-mix(in srgb, var(--theme-panel) 60%, transparent)",
    backdropFilter: "blur(10px)",
    border: `1px solid ${C.goldDim}`,
    borderRadius: 14,
    padding: "14px 20px",
    marginBottom: 20,
    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
  },
  codeLabel: {
    fontSize: 10,
    letterSpacing: 2.5,
    color: C.parchDim,
    fontWeight: 600,
  },
  codeBig: {
    fontFamily: serifDisplay,
    fontSize: 32,
    color: C.gold,
    letterSpacing: "8px",
    fontWeight: 800,
  },
  copyBtn: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    color: C.parchDim,
    background: "color-mix(in srgb, var(--theme-panel) 80%, transparent)",
    border: `1px solid color-mix(in srgb, var(--theme-line) 50%, transparent)`,
    borderRadius: 8,
    padding: "5px 11px",
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  h2: {
    fontFamily: serifDisplay,
    fontSize: 18,
    color: C.gold,
    display: "flex",
    alignItems: "center",
    gap: 8,
    margin: "24px 0 12px",
    fontWeight: 600,
  },
  playerGrid: { display: "flex", flexWrap: "wrap", gap: 9 },
  playerChip: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 16px",
    borderRadius: 24,
    background: "color-mix(in srgb, var(--theme-panel2) 50%, transparent)",
    backdropFilter: "blur(4px)",
    border: `1px solid color-mix(in srgb, var(--theme-line) 40%, transparent)`,
    fontSize: 14,
    color: C.parch,
    fontWeight: 500,
  },
  playerChipMe: {
    borderColor: C.gold,
    background: "color-mix(in srgb, var(--theme-gold) 12%, transparent)",
    boxShadow: "0 0 12px rgba(227,169,60,0.15)",
  },
  optGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  optBtn: {
    textAlign: "left",
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  optDesc: { fontSize: 12, color: C.parchDim, opacity: 0.85, lineHeight: 1.4 },
  note: {
    fontSize: 13,
    color: C.parchDim,
    margin: "12px 0 0",
    fontStyle: "italic",
  },
  noteDim: {
    fontSize: 12,
    color: C.goldDim,
    margin: "8px 0 0",
    fontStyle: "italic",
  },
  waiting: {
    textAlign: "center",
    color: C.parchDim,
    fontStyle: "italic",
    padding: "24px 0",
    fontSize: 15.5,
  },
  leave: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    margin: "24px auto 0",
    background: "transparent",
    border: "none",
    color: C.parchDim,
    fontSize: 13.5,
    fontWeight: 500,
    opacity: 0.85,
  },

  /* Role */
  roleCard: {
    borderRadius: 16,
    border: "1.5px solid",
    padding: 24,
    boxShadow: "0 15px 35px rgba(0,0,0,.5)",
    backdropFilter: "blur(8px)",
  },
  /* ------------------------- expansions & plot cards ------------------- */
  setupWarn: {
    border: `1.5px solid ${C.evil}`,
    background: "rgba(193,74,63,.10)",
    borderRadius: 12,
    padding: "10px 14px",
    margin: "12px 0 4px",
    fontSize: 12.5,
    lineHeight: 1.7,
    color: C.parch,
  },
  expStrip: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    margin: "0 0 12px",
  },
  expChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    border: `1px solid color-mix(in srgb, ${C.gold} 45%, transparent)`,
    background: "rgba(226,177,60,.10)",
    borderRadius: 999,
    padding: "5px 11px",
    fontSize: 11.5,
    color: C.parch,
    fontWeight: 600,
  },
  plotHandWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 12,
  },
  plotCard: {
    textAlign: "left",
    border: `1.5px solid color-mix(in srgb, ${C.gold} 55%, transparent)`,
    background: "linear-gradient(150deg, rgba(226,177,60,.12), rgba(0,0,0,.25))",
    borderRadius: 12,
    padding: "10px 12px",
    color: C.parch,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  plotCardName: {
    fontFamily: serifDisplay,
    fontSize: 14.5,
    fontWeight: 700,
    color: C.gold,
  },
  plotCardDesc: { fontSize: 11.5, lineHeight: 1.5, color: C.parchDim },
  secretRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: `1px solid color-mix(in srgb, ${C.gold} 35%, transparent)`,
    background: "rgba(0,0,0,.25)",
    borderRadius: 10,
    padding: "8px 11px",
    fontSize: 12.5,
    color: C.parch,
  },
  logRow: {
    fontSize: 11.5,
    color: C.parchDim,
    lineHeight: 1.7,
  },
  roleTeam: {
    fontSize: 10.5,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    color: C.parchDim,
    fontWeight: 600,
    opacity: 0.85,
  },
  roleName: {
    fontFamily: serifDisplay,
    fontSize: 28,
    color: C.parch,
    fontWeight: 700,
    marginTop: 2,
  },
  roleDesc: {
    fontSize: 15,
    lineHeight: 1.6,
    color: C.parch,
    marginTop: 14,
    opacity: 0.95,
    fontStyle: "italic",
  },
  knowBox: {
    marginTop: 18,
    paddingTop: 16,
    borderTop:
      "1px solid color-mix(in srgb, var(--theme-line) 30%, transparent)",
  },
  knowLabel: {
    fontSize: 13,
    color: C.gold,
    marginBottom: 10,
    fontStyle: "italic",
    fontWeight: 500,
  },
  knowNames: { display: "flex", flexWrap: "wrap", gap: 8 },
  knowName: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "6px 14px",
    borderRadius: 20,
    background: "rgba(0,0,0,.35)",
    border: `1px solid ${C.goldDim}`,
    fontSize: 14,
    color: C.parch,
  },
  knowEmpty: {
    color: C.parchDim,
    fontSize: 13,
    fontStyle: "italic",
    opacity: 0.8,
  },

  /* ================= CIRCULAR TABLE ================= */
  tableContainer: {
    position: "relative",
    width: "100%",
    margin: "24px auto",
  },
  tableCenter: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    zIndex: 1,
  },
  centerPhase: { textAlign: "center", marginTop: 4 },
  phaseText: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13.5,
    color: C.gold,
    fontStyle: "italic",
    fontWeight: 500,
  },

  /* Seat nodes */
  seatNode: {
    position: "absolute",
    width: 64,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    zIndex: 2,
  },
  avatarRing: {
    width: 60,
    height: 60,
    borderRadius: "50%",
    border: "2.5px solid",
    overflow: "hidden",
    position: "relative",
    background: "color-mix(in srgb, var(--theme-panel2) 80%, transparent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 20px rgba(0,0,0,0.55)",
  },
  avatarVideo: { width: "100%", height: "100%", objectFit: "cover" },
  avatarLetter: {
    fontFamily: serifDisplay,
    fontSize: 24,
    color: C.gold,
    fontWeight: 700,
  },
  micBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: C.ink2,
    border: `1px solid color-mix(in srgb, var(--theme-line) 80%, transparent)`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
  },
  crownBadge: {
    position: "absolute",
    top: -6,
    left: "50%",
    transform: "translateX(-50%)",
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: C.ink2,
    border: `1px solid ${C.goldDim}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
  },
  checkBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: C.gold,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
  },
  seatName: {
    fontSize: 11.5,
    textAlign: "center",
    fontWeight: 500,
    whiteSpace: "nowrap",
    maxWidth: 68,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  youTag: { fontSize: 9.5, color: C.goldDim, marginLeft: 3, fontWeight: 600 },

  /* Action area below table */
  actionArea: { marginTop: 12 },
  actionCard: {
    background: "color-mix(in srgb, var(--theme-panel) 75%, transparent)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: `1px solid color-mix(in srgb, var(--theme-line) 40%, transparent)`,
    borderRadius: 16,
    padding: 20,
    marginBottom: 10,
    boxShadow:
      "0 12px 32px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,0.05)",
  },
  actionTitle: {
    fontFamily: serifDisplay,
    fontSize: 17.5,
    color: C.gold,
    marginBottom: 14,
    fontWeight: 600,
  },
  waitCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: C.parchDim,
    fontSize: 14.5,
    padding: "12px 16px",
    background: "color-mix(in srgb, var(--theme-panel) 40%, transparent)",
    borderRadius: 12,
    border: `1.5px dashed color-mix(in srgb, var(--theme-line) 30%, transparent)`,
  },

  seatGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  seat: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "12px 14px",
    borderRadius: 10,
    border: `1px solid color-mix(in srgb, var(--theme-line) 50%, transparent)`,
    background: "color-mix(in srgb, var(--theme-ink2) 60%, transparent)",
    color: C.parch,
    fontSize: 14.5,
    fontWeight: 500,
  },
  seatSel: {
    borderColor: C.gold,
    background: `linear-gradient(180deg, ${C.gold}, ${C.goldDim})`,
    color: C.ink,
    fontWeight: 600,
  },
  teamPills: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  teamPill: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 14px",
    borderRadius: 20,
    background: "color-mix(in srgb, var(--theme-ink) 50%, transparent)",
    border: `1px solid ${C.goldDim}`,
    fontSize: 14,
    color: C.parch,
    fontWeight: 500,
  },
  voteBtns: { display: "flex", gap: 12 },
  approve: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "14px",
    borderRadius: 10,
    border: `1.5px solid ${C.good}`,
    background: "rgba(63,159,142,.12)",
    color: C.good,
    fontSize: 15.5,
    fontWeight: 700,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    fontFamily: serifDisplay,
  },
  reject: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "14px",
    borderRadius: 10,
    border: `1.5px solid ${C.evil}`,
    background: "rgba(193,74,63,.12)",
    color: C.evil,
    fontSize: 15.5,
    fontWeight: 700,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    fontFamily: serifDisplay,
  },

  /* Quest tracker */
  tracker: {
    display: "flex",
    gap: 8,
    justifyContent: "center",
    marginBottom: 10,
  },
  questOrb: {
    position: "relative",
    width: 44,
    height: 48,
    borderRadius: 12,
    border: "2px solid",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
  },
  questNum: {
    fontFamily: serifDisplay,
    fontSize: 18,
    color: C.parch,
    fontWeight: 700,
  },
  questSub: {
    fontSize: 9,
    color: C.parchDim,
    letterSpacing: 1,
    fontWeight: 600,
    opacity: 0.8,
  },
  orbMark: { position: "absolute", top: 2, right: 2 },
  voteTrack: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    marginBottom: 8,
  },
  voteTrackLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: C.parchDim,
    textTransform: "uppercase",
    fontWeight: 600,
  },
  pip: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    border: "2px solid",
    display: "inline-block",
    transition: "all 0.2s ease",
  },
  dangerText: { color: C.evil, fontSize: 12, fontWeight: 800, marginLeft: 2 },

  /* Banners */
  banner: {
    background: "color-mix(in srgb, var(--theme-panel) 75%, transparent)",
    backdropFilter: "blur(8px)",
    border: "1.5px solid",
    borderRadius: 12,
    padding: "12px 16px",
    marginBottom: 12,
    boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
  },
  bannerHead: {
    fontFamily: serifDisplay,
    fontSize: 14.5,
    color: C.gold,
    marginBottom: 8,
    fontWeight: 600,
  },
  bannerRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13.5,
    color: C.parch,
    marginTop: 4,
    opacity: 0.9,
  },

  /* Secret role peek */
  secretWrap: { textAlign: "center", marginTop: 16 },
  secretBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 16px",
    borderRadius: 24,
    border: `1px solid color-mix(in srgb, var(--theme-line) 60%, transparent)`,
    background: "color-mix(in srgb, var(--theme-panel) 70%, transparent)",
    color: C.parchDim,
    fontSize: 13,
    fontWeight: 500,
    boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
  },
  secretCard: {
    marginTop: 10,
    display: "inline-block",
    padding: "10px 18px",
    borderRadius: 12,
    border: "1px solid",
    background: "color-mix(in srgb, var(--theme-ink2) 90%, transparent)",
    boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
  },

  /* End screen */
  endBanner: {
    borderRadius: 16,
    border: "2px solid",
    padding: 24,
    textAlign: "center",
    marginBottom: 20,
    boxShadow: "0 15px 40px rgba(0,0,0,.6)",
    backdropFilter: "blur(8px)",
  },
  endTitle: {
    fontFamily: serifDisplay,
    fontSize: 34,
    color: C.parch,
    margin: "10px 0 8px",
    fontWeight: 800,
    letterSpacing: "1px",
  },
  endReason: {
    fontSize: 15.5,
    lineHeight: 1.6,
    color: C.parch,
    opacity: 0.95,
    margin: 0,
    fontStyle: "italic",
  },
  revealGrid: { display: "flex", flexDirection: "column", gap: 8 },
  revealRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid",
    fontSize: 14.5,
  },
  daggerTag: { fontSize: 11, color: C.evil, marginLeft: 8, fontWeight: 600 },

  /* Voice bar */
  voiceBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    background: "color-mix(in srgb, var(--theme-panel) 75%, transparent)",
    backdropFilter: "blur(12px)",
    border: `1.5px solid color-mix(in srgb, var(--theme-line) 40%, transparent)`,
    borderRadius: 12,
    padding: "8px 16px",
    marginBottom: 16,
    boxShadow:
      "0 6px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)",
  },
  voiceLeft: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 },
  voiceTitle: {
    fontFamily: serifDisplay,
    fontSize: 15,
    color: C.gold,
    letterSpacing: "0.5px",
    fontWeight: 600,
  },
  voiceHint: {
    fontSize: 11.5,
    color: C.parchDim,
    fontStyle: "italic",
    opacity: 0.8,
  },
  voiceRight: { display: "flex", alignItems: "center", gap: 6 },
  voiceJoin: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 14px",
    borderRadius: 20,
    border: `1.5px solid ${C.good}`,
    background: "rgba(63,159,142,.12)",
    color: C.good,
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    fontFamily: serifDisplay,
  },
  voiceIconBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderRadius: "50%",
    border: `1.5px solid color-mix(in srgb, var(--theme-line) 60%, transparent)`,
    background: "color-mix(in srgb, var(--theme-ink2) 80%, transparent)",
    color: C.parch,
  },
  voiceLeaveBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderRadius: "50%",
    border: `1.5px solid ${C.evilDk}`,
    background: "rgba(193,74,63,.12)",
    color: C.parch,
  },

  /* Widescreen gameplay console dashboard */
  gameGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr",
    gap: "24px 30px",
    width: "100%",
    maxWidth: 1040,
    margin: "0 auto",
    alignItems: "start",
    animation: "fadeUp .4s cubic-bezier(0.16, 1, 0.3, 1)",
  },
  gameHeader: {
    gridColumn: "1 / -1",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderBottom: "1.5px solid color-mix(in srgb, var(--theme-line) 20%, transparent)",
    paddingBottom: 16,
  },
  phaseLabel: {
    fontFamily: serifDisplay,
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: "2px",
    textTransform: "uppercase",
    color: C.parch,
    textShadow: "0 2px 10px rgba(0,0,0,0.5)",
  },
  themeSubHeader: {
    display: "flex",
    alignItems: "center",
    fontSize: 13,
    color: C.gold,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    marginTop: 6,
    fontWeight: 700,
  },
  gameLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
    justifyContent: "flex-start",
  },
  gameRight: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    height: 380,
  },
  questBox: {
    background: "color-mix(in srgb, var(--theme-panel) 60%, transparent)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: `1.5px solid color-mix(in srgb, var(--theme-line) 30%, transparent)`,
    borderRadius: 16,
    padding: "16px 20px",
    boxShadow: "0 10px 30px rgba(0,0,0,.4)",
  },
  questTitle: {
    fontSize: 11,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    color: C.parchDim,
    marginBottom: 14,
    fontWeight: 600,
    textAlign: "center",
  },
  gemstoneRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 10,
    maxWidth: 420,
    margin: "0 auto",
  },
  actionConsole: {
    background: "color-mix(in srgb, var(--theme-panel) 75%, transparent)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: `1.5px solid color-mix(in srgb, var(--theme-line) 40%, transparent)`,
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 15px 40px rgba(0,0,0,.5)",
  },
  consoleHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "rgba(0,0,0,0.2)",
    borderBottom: `1.5px solid color-mix(in srgb, var(--theme-line) 30%, transparent)`,
    padding: "12px 16px",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "1px",
    textTransform: "uppercase",
    color: C.parchDim,
  },
  consoleBody: {
    padding: 24,
    minHeight: 110,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  consoleFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "rgba(0,0,0,0.15)",
    borderTop: `1.5px solid color-mix(in srgb, var(--theme-line) 20%, transparent)`,
    padding: "10px 16px",
    fontSize: 11,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    color: C.parchDim,
  },
  wheelContainer: {
    position: "relative",
    width: "100%",
    height: "100%",
    maxWidth: 420,
  },
  wheelCenterRing: {
    position: "absolute",
    left: 210,
    top: 175,
    transform: "translate(-50%, -50%)",
    width: 90,
    height: 90,
    borderRadius: "50%",
    background: "color-mix(in srgb, var(--theme-ink) 95%, transparent)",
    border: `2px solid var(--theme-gold-dim)`,
    boxShadow: "0 0 20px rgba(0,0,0,.6), inset 0 0 10px rgba(227,169,60,.15)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 0,
  },
  personaDeck: {
    gridColumn: "1 / -1",
    background: "linear-gradient(90deg, color-mix(in srgb, var(--theme-panel) 85%, transparent), color-mix(in srgb, var(--theme-ink) 90%, transparent))",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: `1.5px solid color-mix(in srgb, var(--theme-line) 30%, transparent)`,
    borderRadius: 16,
    padding: "16px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 10px 30px rgba(0,0,0,.4)",
    marginTop: 10,
  },
  personaLeft: {
    display: "flex",
    flexDirection: "column",
  },
  personaCenter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  personaRight: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    maxWidth: 320,
  },
  leaveInline: {
    background: "transparent",
    border: "none",
    color: C.parchDim,
    opacity: 0.5,
    fontSize: 11,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
    transition: "opacity 0.2s ease",
  },
};
