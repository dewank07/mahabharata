/* ============================================================================
   The board every phase sits on: grain, watermark, header, and the
   288 | 1fr | 274 column grid that collapses to one column under 1100px.
   ========================================================================== */

import type { ReactNode } from "react";
import {
  BadgeCheck, Crown, LogIn, Mic, MicOff, PhoneCall, PhoneOff, ScrollText,
  Shield, Video, VideoOff,
} from "lucide-react";
import type { Account, Room, Voice } from "./types";

export function TableShell({
  room, theme, voice, emblemSrc, account, error, children,
}: {
  room: Room;
  theme: { name: string };
  voice: Voice;
  emblemSrc: string;
  account: Account;
  error?: string;
  children: ReactNode;
}) {
  const inVoice = room.players.filter((p) => p.inVoice).length
    + room.watchers.filter((p) => p.inVoice).length;

  return (
    <div className="vd-board">
      <div className="vd-content vd-shell">
        <header className="vd-topbar">
          <div className="vd-topbar__left">
            <img src={emblemSrc} alt="" width={24} height={24} className="vd-topbar__emblem" />
            <span className="vd-topbar__brand">VERDICT</span>
            <span className="vd-topbar__theme">{theme.name}</span>
          </div>

          <div className="vd-topbar__right">
            <span className="vd-label vd-label--dim">Room {room.code}</span>

            {/* Account, rules and admin stay reachable from the board. */}
            {account.premium && (
              <span className="vd-pill vd-pill--brass" title="Premium active">
                <BadgeCheck size={11} /> Premium
              </span>
            )}
            <a className="vd-pill" href="#/rules" title="The rules">
              <ScrollText size={11} /> Rules
            </a>
            {account.isAdmin && (
              <a className="vd-pill" href="#/admin" title="Admin console">
                <Shield size={11} /> Admin
              </a>
            )}
            {account.signedIn ? (
              !account.premium && (
                <a className="vd-pill" href="#/upgrade">
                  <Crown size={11} /> Upgrade
                </a>
              )
            ) : (
              <button className="vd-pill" onClick={account.signIn}>
                <LogIn size={11} /> Sign in
              </button>
            )}
            {room.seating.overflowing && (
              <span className="vd-label vd-label--brass">
                {room.seating.seatedCount} seated · {room.seating.watcherCount} watching
              </span>
            )}
            <span className="vd-voicechip">
              <i className={voice.joined ? "is-on" : undefined} />
              Voice · {inVoice} in
            </span>
            {/* Audio and camera stay reachable from every phase. */}
            {voice.joined ? (
              <span className="vd-voicebtns">
                <button className="vd-iconbtn" onClick={voice.toggleMute}
                  aria-label={voice.muted ? "Unmute" : "Mute"} title={voice.muted ? "Unmute" : "Mute"}>
                  {voice.muted ? <MicOff size={13} /> : <Mic size={13} />}
                </button>
                <button className="vd-iconbtn" onClick={voice.toggleCamera}
                  aria-label={voice.camOn ? "Camera off" : "Camera on"}
                  title={voice.camOn ? "Camera off" : "Camera on"}>
                  {voice.camOn ? <Video size={13} /> : <VideoOff size={13} />}
                </button>
                <button className="vd-iconbtn" onClick={voice.leave}
                  aria-label="Leave voice" title="Leave voice">
                  <PhoneOff size={13} />
                </button>
              </span>
            ) : (
              <button className="vd-iconbtn" onClick={voice.join} aria-label="Join voice" title="Join voice">
                <PhoneCall size={13} />
              </button>
            )}
          </div>
        </header>

        {error && <div className="vd-panel vd-panel--danger vd-errline">{error}</div>}

        {children}
      </div>
    </div>
  );
}

/** Left column of the table: quest plate, ladder, rejection track. */
export function Column({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

/**
 * The one line above the primary action. The design moved the "named" count out
 * of the seal's centre to here, so the ring reads as seats and nothing else.
 */
export function ActionLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="vd-actionline">
      <span className="vd-label">{label}</span>
      {value && <span className="vd-label vd-label--brass">{value}</span>}
    </div>
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
