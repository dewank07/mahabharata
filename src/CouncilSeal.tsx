/* ============================================================================
   CouncilSeal — the engraved ring of seats. One component for every phase:
   lobby, propose, vote and the reckoning all render this with a different
   `state` per seat.
   ========================================================================== */

import { Sigil } from "./sigils";

export type SeatState =
  | "idle"      // seated, nothing to say
  | "leader"    // holds the seal this round
  | "named"     // on the proposed party / riding
  | "voted"     // vote is in (never which way)
  | "spent";    // out of the running: already held the Lady, etc.

export type Seat = {
  playerId: string;
  name: string;
  sigil: number;
  state: SeatState;
  /** Shown under the name in brass. Keep to two words. */
  note?: string;
  /**
   * Live camera feed. When present it fills the disc in place of the sigil, so
   * video survives the redesign without adding a tile grid the board has no
   * room for. Camera off falls back to the heraldic mark.
   */
  stream?: MediaStream | null;
  /** Mirror the local preview, as every video chat does. */
  mirrored?: boolean;
  /** Ring the disc while this player is talking. */
  speaking?: boolean;
};

type Props = {
  seats: Seat[];
  emblemSrc?: string;
  /** Rendered when a seat is tapped. Omit to make the ring read-only. */
  onSelect?: (playerId: string) => void;
  /** Disable specific seats (already named, cannot be inspected, …). */
  isDisabled?: (seat: Seat) => boolean;
  className?: string;
};

/** Seats start at the top and run clockwise, matching `players.seat` order. */
function seatPosition(i: number, n: number) {
  const angle = (-90 + (360 / n) * i) * (Math.PI / 180);
  const r = 42; // % of the seal box — puts tokens on the outer rule
  return { left: `${50 + r * Math.cos(angle)}%`, top: `${50 + r * Math.sin(angle)}%` };
}

/** Eight engraved marks; the three cardinals that aren't the leader are brass. */
const MARKS = [30, 60, 120, 150, 210, 240, 300, 330];
const CARDINALS = [90, 180, 270];

/**
 * Seats sit on a circle, so the space each one gets is the circumference over
 * `n`. Past ten the ring has to grow and the discs shrink or they collide: at
 * radius 42% the arc per seat is ~2.64·W/n, which must stay above the seat's
 * own width. These three bands keep that true all the way to twenty.
 */
function ringMetrics(n: number) {
  if (n <= 10) return { seal: 392, seat: 88, disc: 62, name: 11.5 };
  if (n <= 13) return { seal: 470, seat: 74, disc: 52, name: 10.5 };
  if (n <= 16) return { seal: 530, seat: 68, disc: 46, name: 10 };
  return { seal: 580, seat: 62, disc: 40, name: 9.5 };
}

export function CouncilSeal({ seats, emblemSrc, onSelect, isDisabled, className }: Props) {
  const n = seats.length;
  const m = ringMetrics(n);

  return (
    <div
      className={`vd-seal ${className ?? ""}`}
      style={{
        maxWidth: m.seal,
        ["--vd-seat-w" as string]: `${m.seat}px`,
        ["--vd-seat-disc" as string]: `${m.disc}px`,
        ["--vd-seat-name" as string]: `${m.name}px`,
      }}
    >
      <div className="vd-seal__ring" />
      <div className="vd-seal__ring-inner" />

      {MARKS.map((deg) => (
        <div key={deg} className="vd-seal__mark" style={{ rotate: `${deg}deg` }}><i /></div>
      ))}
      {CARDINALS.map((deg) => (
        <div key={`c${deg}`} className="vd-seal__mark vd-seal__mark--brass" style={{ rotate: `${deg}deg` }}><i /></div>
      ))}

      {emblemSrc && <img className="vd-seal__emblem" src={emblemSrc} alt="" aria-hidden />}

      {seats.map((seat, i) => {
        const disabled = isDisabled?.(seat) ?? !onSelect;
        const named = seat.state === "named";
        return (
          <button
            key={seat.playerId}
            type="button"
            className={[
              "vd-seat",
              seat.state === "leader" && "is-leader",
              named && "is-named",
              seat.state === "voted" && "is-voted",
              seat.state === "spent" && "is-spent",
              seat.speaking && "is-speaking",
            ].filter(Boolean).join(" ")}
            style={{
              ...seatPosition(i, n),
              // lets the crescent cut itself out against the right face
              ["--vd-seat-face" as string]: named ? "var(--vd-parchment)" : "var(--vd-bg-raised)",
            }}
            disabled={disabled}
            aria-pressed={named}
            aria-label={`${seat.name}${seat.note ? `, ${seat.note}` : ""}`}
            onClick={() => onSelect?.(seat.playerId)}
          >
            <span className="vd-seat__disc">
              {seat.stream ? (
                <video
                  className="vd-seat__video"
                  autoPlay
                  playsInline
                  muted={seat.mirrored}
                  style={seat.mirrored ? { transform: "scaleX(-1)" } : undefined}
                  ref={(el) => {
                    if (el && el.srcObject !== seat.stream) el.srcObject = seat.stream!;
                  }}
                />
              ) : (
                <Sigil
                  index={seat.sigil}
                  size={named ? 24 : 22}
                  color={named ? "var(--vd-red)" : seat.state === "leader" ? "var(--vd-parchment-2)" : "#7b7266"}
                />
              )}
              {named && <span className="vd-seat__stud" />}
            </span>
            <span className="vd-seat__name">{seat.name}</span>
            {seat.note && <span className="vd-seat__state">{seat.note}</span>}
          </button>
        );
      })}
    </div>
  );
}
