/* ============================================================================
   08 · The reckoning.

   A ledger of allegiances, not a scoreboard: `winReason` in the engine's own
   words, the five-quest board, then every seat in order with its role. Evil rows
   are tinted; Merlin's row is brass.
   ========================================================================== */

import { RefreshCw } from "lucide-react";
import { QuestLadder } from "../TableParts";
import { QUEST_SIZES, DOUBLE_FAIL_QUEST } from "../../convex/logic";
import { Studded } from "./TableShell";
import { type TableProps, nameOf } from "./types";

export function ReckoningScreen({
  room, pid, theme, act, onNewGame,
}: Pick<TableProps, "room" | "pid" | "theme" | "act"> & {
  onNewGame: () => Promise<unknown>;
}) {
  const goodWon = room.winner === "good";
  const isHost = room.hostId === pid;
  const n = room.players.length;
  const named = [room.assassinGuess, room.assassinGuess2].filter(Boolean) as string[];

  const roleName = (id: string | null) =>
    id ? room.theme.roles.find((r) => r.id === id)?.name ?? id : "—";

  return (
    <div className="vd-table vd-table-layout">
      <div className="vd-stack">
        <Studded className={`vd-role ${goodWon ? "" : "vd-role--evil"}`}>
          <div className="vd-role__side">
            {goodWon ? theme.goodTeamName : theme.evilTeamName}
          </div>
          <div className="vd-role__name" style={{ fontSize: 30 }}>
            {goodWon ? "The realm holds" : "The realm falls"}
          </div>
          <p className="vd-voice" style={{ margin: 0 }}>{room.winReason}</p>
        </Studded>

        <QuestLadder
          sizes={QUEST_SIZES[n] ?? []}
          questIndex={-1}
          results={room.questResults}
          doubleFailIndex={n >= 7 ? DOUBLE_FAIL_QUEST : undefined}
        />

        {room.lancelot?.swapped && (
          <p className="vd-voice">
            The loyalty deck turned: the Lancelots ended on the opposite sides to
            which they were dealt.
          </p>
        )}
        {room.lady?.last && (
          <p className="vd-voice" style={{ fontSize: 13 }}>
            {room.lady.last.holderName} last looked into the water at{" "}
            {room.lady.last.targetName}.
          </p>
        )}
        {room.excalibur?.last?.used && (
          <p className="vd-voice" style={{ fontSize: 13 }}>
            Excalibur was turned on {room.excalibur.last.targetName} by{" "}
            {room.excalibur.last.holderName}.
          </p>
        )}
      </div>

      <div className="vd-centre">
        <div className="vd-centre__wide vd-stack vd-stack--tight">
          <span className="vd-label">The allegiances</span>
          {room.players.map((p) => {
            const evil = p.team === "evil";
            const isMerlin = p.role === "merlin";
            const turned =
              p.team != null &&
              p.role != null &&
              ((p.role === "lancelot_good" && p.team === "evil") ||
                (p.role === "lancelot_evil" && p.team === "good"));
            return (
              <div
                key={p.playerId}
                className={`vd-tile ${evil ? "vd-tile--evil" : ""} ${isMerlin ? "vd-tile--brass" : ""}`}
              >
                <span className="vd-tile__seat">{p.seat + 1}</span>
                {p.name}
                <span
                  className="vd-tile__meta"
                  style={{ color: evil ? "var(--vd-red-ink)" : "var(--vd-brass)" }}
                >
                  {roleName(p.role)}
                  {turned ? " · turned" : ""}
                  {named.includes(p.playerId) ? " · named" : ""}
                </span>
              </div>
            );
          })}

          {room.watchers.length > 0 && (
            <>
              <span className="vd-label vd-label--dim" style={{ marginTop: 12 }}>
                Watched from the queue
              </span>
              {room.watchers.map((w) => (
                <div key={w.playerId} className="vd-tile" style={{ opacity: 0.6 }}>
                  {w.name}
                  <span className="vd-tile__meta">no role</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="vd-centre__wide vd-actionbar">
          {isHost ? (
            <button className="vd-btn vd-btn--primary" onClick={act(onNewGame)}>
              <span>Wage war anew — same company</span>
              <RefreshCw size={16} />
            </button>
          ) : (
            <div className="vd-panel">
              <p className="vd-voice" style={{ margin: 0 }}>
                Waiting on the host to set the board again.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="vd-stack">
        <span className="vd-label">What the knife did</span>
        <p className="vd-voice">
          {room.assassinMode === "lovers"
            ? `The Assassin named ${named.map((id) => nameOf(room, id)).join(" and ")}.`
            : room.assassinGuess
              ? `The Assassin named ${nameOf(room, room.assassinGuess)}.`
              : "The knife was never drawn — the quests decided it."}
        </p>
      </div>
    </div>
  );
}
