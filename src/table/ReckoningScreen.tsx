/* ============================================================================
   08 · The reckoning.

   A ledger of allegiances, not a scoreboard: the verdict struck at display
   size in the engine's own words, the five missions landing one last time as
   coins, then every seat in order with the character behind it.

   The board is the SAME coin the status strip deals, a size larger, rather
   than `QuestLadder` — a second drawing of the same five facts that had to be
   kept in step with the strip by hand, and drifted.
   ========================================================================== */

import { RefreshCw } from "lucide-react";
import { characterFor } from "../characters";
import { QUEST_SIZES } from "../../convex/logic";
import { Waiting } from "./TableShell";
import { type TableProps, displayName, nameOf } from "./types";

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
  const teams = { good: room.theme.goodTeamName, evil: room.theme.evilTeamName };

  return (
    <div className="vd-table vd-table-layout">
      <div className="vd-stack">
        {/* The verdict, struck. It was a studded panel with the winner as a
            30px heading inside it; the system makes the result the largest
            thing on the screen and gives it the display face at 52px, with
            the engine's own `winReason` under it. */}
        <div className={`vd-verdict ${goodWon ? "" : "vd-verdict--evil"}`}>
          <div className="vd-verdict__side">
            {goodWon ? theme.goodTeamName : theme.evilTeamName}
          </div>
          <h1 className="vd-verdict__name">
            {goodWon ? `${theme.goodTeamName} win` : `${theme.evilTeamName} win`}
          </h1>
          <p className="vd-verdict__why">{room.winReason}</p>
        </div>

        {/* The five, one more time — the same coins the strip deals, struck a
            size larger. `QuestLadder` was a second, different drawing of the
            board that had to be kept in step with the strip by hand. */}
        <div className="vd-result" role="group" aria-label="How the five missions went">
          {(QUEST_SIZES[n] ?? []).map((size, i) => {
            const r = room.questResults[i];
            const q = (room.questLog ?? []).find((x) => x.questIndex === i);
            return (
              <span
                key={i}
                className={`vd-slot ${r === "success" ? "is-held" : r === "fail" ? "is-fail" : ""}`}
                aria-label={
                  q
                    ? `Mission ${i + 1}: ${q.successes} succeeded, ${q.fails} failed`
                    : `Mission ${i + 1}: never ridden, ${size} would have gone`
                }
              >
                <span className="vd-slot__face" aria-hidden>
                  {r === "success" ? "\u2726" : r === "fail" ? "\u2715" : size}
                </span>
              </span>
            );
          })}
        </div>

        {room.lancelot?.swapped && (
          <p className="vd-hint">
            The two Lancelots swapped sides during the game.
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

          {/* The ledger this used to be was a list of names with a role written
              beside each. It is the same information — seat, player, character,
              side — dealt out as the cards everyone has been looking at all
              game, because this screen is the moment the table finds out who
              everybody was. */}
          {/* One raised row per seat: the face at card proportion, the player,
              the character under them in the display face, the side struck at
              the end. The card grid said the same thing at four times the
              height, and this screen is a list to read down, not a gallery. */}
          <div className="vd-whowas">
            {room.players.map((p, i) => {
              const evil = p.team === "evil";
              const character = p.role ? characterFor(room.theme, p.role) : null;
              const turned =
                p.team != null &&
                p.role != null &&
                ((p.role === "lancelot_good" && p.team === "evil") ||
                  (p.role === "lancelot_evil" && p.team === "good"));
              const notes = [
                turned ? "Swapped sides" : null,
                named.includes(p.playerId) ? "Named at the end" : null,
              ].filter(Boolean);
              return (
                <div
                  key={p.playerId}
                  className={`vd-whowas__row ${evil ? "is-evil" : ""}`}
                  style={{ animationDelay: `calc(var(--stagger) * ${i})` }}
                >
                  {character?.image ? (
                    <img className="vd-whowas__face" src={character.image} alt="" />
                  ) : (
                    <span
                      className="vd-whowas__face vd-whowas__mono"
                      style={{ color: evil ? "var(--evil-lit)" : "var(--vd-brass)" }}
                      aria-hidden
                    >
                      {character?.monogram ?? "?"}
                    </span>
                  )}
                  <span className="vd-whowas__body">
                    <span className="vd-whowas__who">{displayName(p.name)}</span>
                    <span className="vd-whowas__role" style={{ display: "block" }}>
                      {roleName(p.role)}
                    </span>
                    {notes.length > 0 && (
                      <span className="vd-whowas__note">{notes.join(" \u00b7 ")}</span>
                    )}
                  </span>
                  <span className="vd-whowas__side">
                    {evil ? theme.evilTeamName : theme.goodTeamName}
                  </span>
                </div>
              );
            })}
          </div>

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
                Same places, new roles — you can change the setup first.
              </span>
            </>
          ) : (
            <Waiting>Waiting for the host. Your place is kept.</Waiting>
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
