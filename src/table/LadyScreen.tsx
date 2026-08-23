/* ============================================================================
   06 · The Lady of the Lake (7+ players).

   A grid of eligible targets; anyone who has already held the Lady is rendered
   at half strength and disabled, with the reason named. The result is private —
   the table only ever learns that you looked.
   ========================================================================== */

import { Eye } from "lucide-react";
import { Plate } from "../TableParts";
import { type TableProps, nameOf } from "./types";

export function LadyScreen({
  room, pid, act, onUse,
}: Pick<TableProps, "room" | "pid" | "act"> & {
  onUse: (targetId: string) => Promise<unknown>;
}) {
  const holderId = room.lady?.holderId ?? null;
  const history = room.lady?.history ?? [];
  const mine = holderId === pid;
  const ladyName = room.theme.expansions?.lady?.name ?? "The Lady of the Lake";

  if (!mine) {
    return (
      <Plate eyebrow={ladyName} title={nameOf(room, holderId)}>
        <p className="vd-voice" style={{ marginTop: 14, textAlign: "center" }}>
          {nameOf(room, holderId)} is looking into the water. Whatever surfaces,
          only they will see it.
        </p>
      </Plate>
    );
  }

  return (
    <Plate eyebrow={ladyName} title="Look into the water">
      <p className="vd-voice" style={{ marginTop: 14, textAlign: "center" }}>
        Choose one. You alone learn their true allegiance — and the Lady then
        passes to them.
      </p>
      <div className="vd-grid2" style={{ marginTop: 18 }}>
        {room.players
          .filter((p) => p.playerId !== pid)
          .map((p) => {
            const spent = history.includes(p.playerId);
            return (
              <button
                key={p.playerId}
                className="vd-tile vd-tile--btn"
                disabled={spent}
                title={spent ? "Has already held the Lady" : undefined}
                onClick={act(() => onUse(p.playerId))}
              >
                <Eye size={13} color={spent ? "var(--vd-ink-dim)" : "var(--vd-brass)"} />
                {p.name}
                {spent && <span className="vd-tile__meta">held it</span>}
              </button>
            );
          })}
      </div>
      <p className="vd-voice" style={{ marginTop: 14, fontSize: 13 }}>
        Anyone who has carried the Lady can never be examined again.
      </p>
    </Plate>
  );
}
