/* ============================================================================
   Sigils — heraldic marks dealt to players instead of avatars.
   Pure geometry (no illustration, no emoji): they read at 18px on a phone and
   stay legible in parchment-on-dark and dark-on-parchment.

   A sigil is derived from the player's stable id, so it survives reconnects and
   is identical on every client without storing anything new in Convex.
   If you'd rather pin it, add `sigil: v.optional(v.number())` to the players
   table and write the index at join time.
   ========================================================================== */

export type SigilProps = { size?: number; color: string };

const disc = (color: string, size: number) => ({
  width: size, height: size, borderRadius: "50%", background: color,
});

/** 10 marks — one per seat at the maximum table size. */
export const SIGILS: Array<(p: SigilProps) => JSX.Element> = [
  // 0 · sun — the seal-bearer's mark reads well with a brass rim
  ({ size = 24, color }) => (
    <span style={{
      width: size, height: size, borderRadius: "50%",
      border: `2px solid ${color}`, display: "grid", placeItems: "center",
    }}>
      <span style={disc(color, size * 0.36)} />
    </span>
  ),
  // 1 · peak
  ({ size = 24, color }) => (
    <span style={{ width: size, height: size, background: color, clipPath: "polygon(50% 0,100% 100%,0 100%)" }} />
  ),
  // 2 · lozenge
  ({ size = 24, color }) => (
    <span style={{ width: size * 0.82, height: size * 0.82, background: color, rotate: "45deg" }} />
  ),
  // 3 · crest (three bars)
  ({ size = 24, color }) => (
    <span style={{ display: "flex", gap: size * 0.16, alignItems: "flex-end" }}>
      <i style={{ width: size * 0.22, height: size * 0.54, background: color }} />
      <i style={{ width: size * 0.22, height: size * 0.92, background: color }} />
      <i style={{ width: size * 0.22, height: size * 0.54, background: color }} />
    </span>
  ),
  // 4 · crescent — cut with a second disc in the token's own colour
  ({ size = 24, color }) => (
    <span style={{ position: "relative", overflow: "hidden", ...disc(color, size) }}>
      <span style={{
        position: "absolute", left: size * 0.32, top: -size * 0.14,
        ...disc("var(--vd-seat-face, #191612)", size),
      }} />
    </span>
  ),
  // 5 · orb
  ({ size = 24, color }) => <span style={disc(color, size * 0.72)} />,
  // 6 · gate (open square)
  ({ size = 24, color }) => (
    <span style={{ width: size * 0.72, height: size * 0.72, border: `2px solid ${color}` }} />
  ),
  // 7 · ring
  ({ size = 24, color }) => (
    <span style={{ width: size * 0.78, height: size * 0.78, borderRadius: "50%", border: `2px solid ${color}` }} />
  ),
  // 8 · cross
  ({ size = 24, color }) => (
    <span style={{ position: "relative", width: size, height: size }}>
      <i style={{ position: "absolute", left: "50%", translate: "-50% 0", width: size * 0.18, height: size, background: color }} />
      <i style={{ position: "absolute", top: "50%", translate: "0 -50%", height: size * 0.18, width: size, background: color }} />
    </span>
  ),
  // 9 · chevron
  ({ size = 24, color }) => (
    <span style={{
      width: size, height: size * 0.62, background: color,
      clipPath: "polygon(50% 0,100% 50%,100% 100%,50% 50%,0 100%,0 50%)",
    }} />
  ),
];

/** Stable, collision-tolerant index from a player id (FNV-1a). */
export function sigilIndex(playerId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < playerId.length; i++) {
    h ^= playerId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h) % SIGILS.length;
}

/**
 * Deal distinct sigils to a table: hash first, then resolve collisions by
 * walking to the next free mark. Deterministic given the same seat order, so
 * every client renders the same board.
 */
export function dealSigils(playerIds: string[]): Record<string, number> {
  const taken = new Set<number>();
  const out: Record<string, number> = {};
  for (const id of playerIds) {
    let i = sigilIndex(id);
    while (taken.has(i)) i = (i + 1) % SIGILS.length;
    taken.add(i);
    out[id] = i;
  }
  return out;
}

export function Sigil({ index, size = 24, color }: { index: number; size?: number; color: string }) {
  const Mark = SIGILS[index % SIGILS.length];
  return <Mark size={size} color={color} />;
}
