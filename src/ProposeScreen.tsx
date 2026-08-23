/* ============================================================================
   ProposeScreen — worked example of composing the system for one phase.
   Every other phase is the same shell with a different centre column.

   Wiring: replace `useRoom()` with your existing Convex query. The shape below
   mirrors convex/schema.ts (rooms + players) — nothing new is required from the
   backend except the seating split, which is derived client-side.
   ========================================================================== */

import { useMemo } from "react";
import { CouncilSeal, type Seat } from "./CouncilSeal";
import { ClockFuse, QuestLadder, RejectionTrack, Chronicle, type ChronicleEntry } from "./TableParts";
import { dealSigils } from "./sigils";
import { splitSeating, type RoomPlayer } from "./seating";
import emblem from "./assets/emblem.png";

const ROMAN = ["I", "II", "III", "IV", "V"];

type RoomView = {
  code: string;
  themeName: string;
  phase: "lobby" | "reveal" | "propose" | "vote" | "quest" | "lady" | "assassin" | "end";
  players: RoomPlayer[];
  leaderId: string;
  meId: string;
  questIndex: number;
  questSizes: number[];                       // QUEST_SIZES[playerCount]
  questResults: (("success" | "fail") | null)[];
  proposedTeam: string[];
  rejectCount: number;
  discussEndsAt: number;
  doubleFailIndex?: number;
  chronicle: ChronicleEntry[];
};

export function ProposeScreen({ room, onToggle, onSubmit }: {
  room: RoomView;
  onToggle: (playerId: string) => void;
  onSubmit: () => void;
}) {
  const { seated } = splitSeating(room.players);
  const sigils = useMemo(() => dealSigils(seated.map((p) => p.playerId)), [seated]);

  const isLeader = room.leaderId === room.meId;
  const needed = room.questSizes[room.questIndex];
  const named = room.proposedTeam;
  const ready = named.length === needed;

  const seats: Seat[] = seated.map((p) => {
    const isNamed = named.includes(p.playerId);
    return {
      playerId: p.playerId,
      name: p.name,
      sigil: sigils[p.playerId],
      state: isNamed ? "named" : p.playerId === room.leaderId ? "leader" : "idle",
      note: isNamed ? "Riding" : p.playerId === room.leaderId ? (isLeader ? "Seal · you" : "Seal") : undefined,
    };
  });

  return (
    <div className="vd-board">
      <div className="vd-content" style={{ display: "flex", flexDirection: "column", minHeight: "100dvh", padding: "22px 36px" }}>

        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 15, borderBottom: "1px solid var(--vd-rule-container)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <img src={emblem} alt="" width={24} height={24} style={{ mixBlendMode: "screen", opacity: 0.8 }} />
            <span style={{ font: "500 15px/1 var(--vd-display)", letterSpacing: ".24em" }}>VERDICT</span>
            <span style={{ marginLeft: 10, paddingLeft: 12, borderLeft: "1px solid var(--vd-rule-container)", font: "italic 400 14px/1 var(--vd-voice)", color: "var(--vd-ink-muted)" }}>
              {room.themeName}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <span className="vd-label vd-label--dim">Room {room.code}</span>
            <span className="vd-label vd-label--dim" style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 6, height: 6, background: "var(--vd-green)" }} />
              Voice · {room.players.filter((p) => p.inVoice).length} in
            </span>
          </div>
        </header>

        <div className="vd-table-layout" style={{ flex: 1, paddingTop: 22 }}>

          {/* ---------------------------------------------------- left ---- */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 13 }}>
              <div className="vd-studded" style={{ width: 50, height: 60, border: "1px solid var(--vd-rule-strong)", display: "grid", placeItems: "center" }}>
                <span className="vd-stud-b" aria-hidden />
                <div style={{ textAlign: "center" }}>
                  <div className="vd-numeral" style={{ fontSize: 24, color: "var(--vd-brass)" }}>{ROMAN[room.questIndex]}</div>
                  <div className="vd-label vd-label--dim" style={{ marginTop: 4, fontSize: 7 }}>Quest</div>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="vd-label">{isLeader ? "You hold the seal" : "The seal is held"}</div>
                <h1 className="vd-h1" style={{ marginTop: 9 }}>
                  {isLeader ? `Name ${needed} riders` : "Await the party"}
                </h1>
              </div>
            </div>

            <p className="vd-voice" style={{ marginTop: 14 }}>
              {needed} shall ride. The council votes the moment they are sent — a tie casts them down.
            </p>

            <div style={{ marginTop: 26 }}>
              <QuestLadder
                sizes={room.questSizes}
                questIndex={room.questIndex}
                results={room.questResults}
                doubleFailIndex={room.doubleFailIndex}
              />
            </div>

            <div style={{ marginTop: 22 }}>
              <RejectionTrack used={room.rejectCount} />
            </div>

            <div className="vd-panel" style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid var(--vd-rule-strong)", display: "grid", placeItems: "center", font: "500 13px/1 var(--vd-display)", color: "var(--vd-ink-soft)" }}>?</div>
                <div>
                  <div className="vd-label vd-label--dim">Your oath</div>
                  <div style={{ marginTop: 5, font: "600 13px/1 var(--vd-ui)" }}>Sealed</div>
                </div>
              </div>
              {/* press-and-hold, never a toggle: the phone is in a room of people */}
              <button className="vd-label vd-label--brass" style={{ background: "none", border: 0, cursor: "pointer" }}>
                Hold to see
              </button>
            </div>
          </div>

          {/* -------------------------------------------------- centre ---- */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 30px" }}>
            <ClockFuse endsAt={room.discussEndsAt} totalMs={3 * 60 * 1000} />

            <CouncilSeal
              seats={seats}
              emblemSrc={emblem}
              onSelect={isLeader ? onToggle : undefined}
              isDisabled={(s) => !isLeader || (!named.includes(s.playerId) && ready)}
              className="vd-seal--table"
            />

            <div style={{ marginTop: 14, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="vd-label">Named · {ROMAN[named.length - 1] ?? "—"} of {ROMAN[needed - 1]}</span>
              <span style={{ font: "600 11px/1 var(--vd-ui)", color: "var(--vd-ink-soft)" }}>
                {named.map((id) => room.players.find((p) => p.playerId === id)?.name).join(" · ")}
              </span>
            </div>

            <div className="vd-actionbar" style={{ marginTop: 10, width: "100%" }}>
              <button className="vd-btn vd-btn--primary" disabled={!isLeader || !ready} onClick={onSubmit}>
                <span>Send them to council</span>
                <span className="vd-btn__meta">{named.length}/{needed}</span>
              </button>
            </div>
          </div>

          {/* --------------------------------------------------- right ---- */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Chronicle entries={room.chronicle} />
            <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid var(--vd-rule-structure)", font: "italic 400 13px/1.55 var(--vd-voice)", color: "var(--vd-ink-dim)" }}>
              Five rejections in one quest and evil takes it unopposed.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
