/* ============================================================================
   08 · The reckoning.

   A ledger of allegiances, not a scoreboard: `winReason` in the engine's own
   words, the five-quest board, then every seat in order with its role. Evil rows
   are tinted; Merlin's row is brass.
   ========================================================================== */

import { RefreshCw } from "lucide-react";
import { QuestLadder } from "../TableParts";
import { QUEST_SIZES, doubleFailQuests } from "../../convex/logic";
import { Studded, Waiting } from "./TableShell";
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
            {goodWon
              ? `${theme.goodTeamName} win`
              : `${theme.evilTeamName} win`}
          </div>
          <p className="vd-voice" style={{ margin: 0 }}>{room.winReason}</p>
        </Studded>

        <QuestLadder
          sizes={QUEST_SIZES[n] ?? []}
          questIndex={-1}
          results={room.questResults}
          doubleFail={doubleFailQuests(n)}
          log={room.questLog ?? []}
        />

        {room.lancelot?.swapped && (
          <p className="vd-voice">
            The two Lancelots swapped sides during the game, so each finished on
            the opposite team to the one they started on.
          </p>
        )}
        {room.lady?.last && (
          <p className="vd-hint">
            {room.lady.last.holderName} last inspected{" "}
            {room.lady.last.targetName}.
          </p>
        )}
        {room.excalibur?.last?.used && (
          <p className="vd-hint">
            {room.excalibur.last.holderName} used Excalibur to flip{" "}
            {room.excalibur.last.targetName}'s card.
          </p>
        )}
      </div>

      <div className="vd-centre">
        <div className="vd-centre__wide vd-stack vd-stack--tight">
          <span className="vd-label">Everyone's real role</span>
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
                  {turned ? " · swapped sides" : ""}
                  {named.includes(p.playerId) ? " · guessed" : ""}
                </span>
              </div>
            );
          })}

          {room.watchers.length > 0 && (
            <>
              <span className="vd-label" style={{ marginTop: 12 }}>
                Watched this game
              </span>
              {room.watchers.map((w) => (
                <div key={w.playerId} className="vd-tile" style={{ opacity: 0.75 }}>
                  {w.name}
                  <span className="vd-tile__meta">No role</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="vd-centre__wide vd-actionbar">
          {isHost ? (
            <>
              <button className="vd-btn vd-btn--primary" onClick={act(onNewGame)}>
                <span>Play again with the same people</span>
                <RefreshCw size={16} />
              </button>
              <span className="vd-hint">
                Everyone keeps their place and gets a new secret role. You can
                change the setup before starting.
              </span>
            </>
          ) : (
            <Waiting>
              Waiting for the host to start another game. Your place is kept.
            </Waiting>
          )}
        </div>
      </div>

      <div className="vd-stack">
        <span className="vd-label">The evil team's final guess</span>
        <p className="vd-voice">
          {room.assassinMode === "lovers"
            ? `They guessed ${named.map((id) => nameOf(room, id)).join(" and ")}.`
            : room.assassinGuess
              ? `They guessed ${nameOf(room, room.assassinGuess)}.`
              : "It never got that far — the missions decided the game."}
        </p>
      </div>
    </div>
  );
}
