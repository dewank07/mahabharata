/* ============================================================================
   01 · Lobby — including the fifteen-in-the-room case.

   The seal fills with the seated; everyone after that is a watcher in a stable
   queue, promoted automatically when a seat empties. The host can also seat a
   watcher directly. `validateSetup()`'s message is shown verbatim where it
   blocks the start.
   ========================================================================== */

import { Crown, Sparkles, Swords, Users } from "lucide-react";
import { PREMIUM_OPT_LABELS } from "../../convex/logic";
import { ChronicleColumn, SeatRing } from "./Parts";
import { ActionLine } from "./TableShell";
import { type TableProps, ROMAN } from "./types";

const ROLE_LABEL: Record<string, string> = {
  percival: "Percival", morgana: "Morgana", ...PREMIUM_OPT_LABELS,
};

export function LobbyScreen({
  room, pid, emblemSrc, act, onStart, onSwapSeat,
}: Pick<TableProps, "room" | "pid" | "emblemSrc" | "act"> & {
  onStart: () => Promise<unknown>;
  onSwapSeat: (watcherId: string, seatedId: string) => Promise<unknown>;
}) {
  const isHost = room.hostId === pid;
  const seatedCount = room.seating.seatedCount;
  const canStart = seatedCount >= 5 && room.setupErrors.length === 0;
  const inPlay = Object.entries(room.opts)
    .filter(([, on]) => on === true)
    .map(([k]) => ROLE_LABEL[k] ?? k);

  return (
    <div className="vd-table vd-table-layout">
      {/* ------------------------------- left ------------------------------ */}
      <div className="vd-stack">
        <div className="vd-studded vd-panel vd-panel--strong">
          <span className="vd-stud-b" aria-hidden />
          <div className="vd-label vd-label--dim">At the table</div>
          <div className="vd-numeral" style={{ fontSize: 44, marginTop: 6 }}>
            {seatedCount}
          </div>
          <div className="vd-label" style={{ marginTop: 8 }}>
            of {room.seating.cap} seats
          </div>
        </div>

        <div className="vd-stack vd-stack--tight">
          <span className="vd-label">Roles in play</span>
          <p className="vd-voice" style={{ margin: 0 }}>
            Merlin and the Assassin always take the field.
            {inPlay.length > 0 && <> Also: {inPlay.join(", ")}.</>}
          </p>
        </div>

        <p className="vd-voice">
          Five to ten play. Anyone beyond the seats watches the board and waits
          for one to empty.
        </p>
      </div>

      {/* ------------------------------ centre ----------------------------- */}
      <div className="vd-centre">
        <SeatRing
          room={room}
          emblemSrc={emblemSrc}
          stateFor={(p) => (p.playerId === pid ? "leader" : "idle")}
          noteFor={(p) =>
            p.isHost ? (p.playerId === pid ? "Host · you" : "Host")
              : p.playerId === pid ? "You" : ROMAN[p.seat] ?? String(p.seat + 1)
          }
        />

        <div className="vd-centre__wide vd-actionbar">
          {/* The validator speaks for itself — shown verbatim. */}
          {room.setupErrors.length > 0 && (
            <div className="vd-panel vd-panel--danger" style={{ marginBottom: 12 }}>
              {room.setupErrors.map((e) => (
                <p key={e} className="vd-voice" style={{ margin: 0, color: "var(--vd-red-ink)" }}>
                  {e}
                </p>
              ))}
            </div>
          )}

          {isHost ? (
            <>
              <ActionLine
                label="Cast the lots"
                value={seatedCount < 5 ? `${5 - seatedCount} MORE NEEDED` : undefined}
              />
              <button className="vd-btn vd-btn--primary" disabled={!canStart} onClick={act(onStart)}>
                <span>
                  {seatedCount < 5
                    ? "Not enough at the table"
                    : room.setupErrors.length > 0
                      ? "Fix the roster to begin"
                      : "Cast the lots & begin"}
                </span>
                <Swords size={16} />
              </button>
            </>
          ) : (
            <div className="vd-panel">
              <p className="vd-voice" style={{ margin: 0 }}>
                {room.seating.iAmWatching
                  ? "You are in the queue. A seat will come to you when one empties."
                  : "You have a seat. Waiting on the host to cast the lots."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------- right ----------------------------- */}
      <div className="vd-stack">
        <div className="vd-stack vd-stack--tight">
          <div className="vd-row" style={{ justifyContent: "space-between" }}>
            <span className="vd-label"><Users size={11} /> Watching</span>
            <span className="vd-label vd-label--brass">{room.seating.watcherCount}</span>
          </div>

          {room.watchers.length === 0 ? (
            <p className="vd-voice" style={{ margin: 0 }}>
              Nobody is waiting. Every seat that matters is filled.
            </p>
          ) : (
            <>
              <div className="vd-watchers">
                {room.watchers.map((w, i) => (
                  <div key={w.playerId} className="vd-watcher">
                    <span className="vd-watcher__q">{i + 1}</span>
                    {w.name}
                    {w.playerId === pid && <span className="vd-tile__meta">you</span>}
                    {isHost && (
                      <button
                        className="vd-watcher__seat"
                        title="Seat this watcher in place of the last seated player"
                        onClick={act(() =>
                          onSwapSeat(
                            w.playerId,
                            room.players[room.players.length - 1].playerId,
                          ),
                        )}
                      >
                        Seat
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="vd-voice" style={{ margin: 0 }}>
                Watchers hear the room and see the board, and are never dealt a
                role. To seat everyone, split the room and run a second table.
              </p>
            </>
          )}
        </div>

        {room.premium.active ? (
          <div className="vd-panel vd-panel--strong">
            <span className="vd-label vd-label--brass">
              <Crown size={11} /> Premium · {room.premium.seatCap} seats
            </span>
          </div>
        ) : (
          <div className="vd-panel">
            <span className="vd-label vd-label--dim">
              <Sparkles size={11} /> Free tier
            </span>
          </div>
        )}

        <ChronicleColumn room={room} />
      </div>
    </div>
  );
}
