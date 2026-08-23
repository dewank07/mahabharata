/* ============================================================================
   Plot cards: the leader's deal, your own hand, your private intel, and the
   public log. Rendered under whichever board is up, since the windows a card
   can be played in span several phases.
   ========================================================================== */

import { useState } from "react";
import { Eye, EyeOff, ScrollText, Sparkles, X } from "lucide-react";
import { type TableProps, nameOf } from "./types";

export function PlotHand({
  room, pid, act, onDeal, onPlay, onDiscard,
}: Pick<TableProps, "room" | "pid" | "act"> & {
  onDeal: (toId: string) => Promise<unknown>;
  onPlay: (card: string, targetId?: string) => Promise<unknown>;
  onDiscard: (card: string) => Promise<unknown>;
}) {
  const [armed, setArmed] = useState<string | null>(null);
  const plots = room.plots;
  const secrets = room.mySecrets ?? [];
  const isLeader = room.players[room.leaderIndex]?.playerId === pid;
  const toDeal = plots?.toDeal ?? 0;
  const hand = plots?.myHand ?? [];
  const plotName = (card: string) =>
    room.theme.expansions?.plots?.cards?.[card] ?? card.replace(/_/g, " ");

  if (!plots && secrets.length === 0) return null;

  /** Which players a card may legally be aimed at. */
  const targets = (card: string) => {
    const others = room.players.filter((p) => p.playerId !== pid);
    const party = room.players.filter((p) => room.proposedTeam.includes(p.playerId));
    switch (card) {
      case "ambush": return party.filter((p) => p.playerId !== pid);
      case "we_found_you": return party;
      case "restore_honor":
        return others.filter((p) => (plots?.handCounts?.[p.playerId] ?? 0) > 0);
      case "show_true_nature": return others;
      case "are_you_the_one": {
        const seat = room.me?.seat ?? 0;
        const n = room.players.length;
        return [room.players[(seat - 1 + n) % n], room.players[(seat + 1) % n]]
          .filter((p) => p && p.playerId !== pid);
      }
      default: return [];
    }
  };

  return (
    <section className="vd-plotstrip">
      {/* --------------------------- the leader deals ---------------------- */}
      {room.phase === "plot" && (
        <div className="vd-stack vd-stack--tight">
          <span className="vd-label">
            <ScrollText size={11} /> {isLeader ? `Deal ${toDeal} face down` : "Plots are being dealt"}
          </span>
          {isLeader ? (
            <div className="vd-grid3">
              {room.players
                .filter((p) => p.playerId !== pid)
                .map((p) => (
                  <button
                    key={p.playerId}
                    className="vd-tile vd-tile--btn"
                    onClick={act(() => onDeal(p.playerId))}
                  >
                    {p.name}
                    {(plots?.handCounts?.[p.playerId] ?? 0) > 0 && (
                      <span className="vd-tile__meta">{plots!.handCounts[p.playerId]}</span>
                    )}
                  </button>
                ))}
            </div>
          ) : (
            <p className="vd-voice" style={{ margin: 0 }}>
              You do not get to see what you are given until you hold it.
            </p>
          )}
        </div>
      )}

      {/* ------------------------------ my hand --------------------------- */}
      {hand.length > 0 && (
        <div className="vd-stack vd-stack--tight">
          <span className="vd-label"><ScrollText size={11} /> Your plots</span>
          {hand.map((h) => {
            const playable =
              h.def.kind === "instant" ? room.phase === "plot" : room.phase === h.def.window;
            const list = playable ? targets(h.card) : [];
            const blocked = playable && h.def.needsTarget && list.length === 0;
            const isArmed = armed === h.card;
            return (
              <div key={h.id} className="vd-panel" style={{ opacity: playable ? 1 : 0.55 }}>
                <div className="vd-row" style={{ justifyContent: "space-between" }}>
                  <span className="vd-label vd-label--brass">{plotName(h.card)}</span>
                  {!playable && <span className="vd-label vd-label--dim">not now</span>}
                </div>
                <p className="vd-voice" style={{ margin: "7px 0 0", fontSize: 13 }}>{h.def.desc}</p>

                {playable && !blocked && !h.def.needsTarget && (
                  <button
                    className="vd-tile vd-tile--btn"
                    style={{ marginTop: 10 }}
                    onClick={act(async () => { await onPlay(h.card); setArmed(null); })}
                  >
                    <Sparkles size={13} color="var(--vd-brass)" /> Play
                  </button>
                )}

                {playable && !blocked && h.def.needsTarget && (
                  <>
                    <button
                      className="vd-tile vd-tile--btn"
                      style={{ marginTop: 10 }}
                      onClick={() => setArmed(isArmed ? null : h.card)}
                    >
                      <Sparkles size={13} color="var(--vd-brass)" />
                      {isArmed ? "Cancel" : "Play — choose a target"}
                    </button>
                    {isArmed && (
                      <div className="vd-grid2" style={{ marginTop: 8 }}>
                        {list.map((t) => (
                          <button
                            key={t.playerId}
                            className="vd-tile vd-tile--btn"
                            onClick={act(async () => {
                              await onPlay(h.card, t.playerId);
                              setArmed(null);
                            })}
                          >
                            {t.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {blocked && (
                  <>
                    <p className="vd-voice" style={{ margin: "7px 0 0", color: "var(--vd-red-ink)", fontSize: 13 }}>
                      No legal target right now.
                    </p>
                    {h.def.kind === "instant" && (
                      <button
                        className="vd-tile vd-tile--btn"
                        style={{ marginTop: 8 }}
                        onClick={act(() => onDiscard(h.card))}
                      >
                        <X size={13} /> Set it aside
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* --------------------------- private intel ------------------------ */}
      {secrets.length > 0 && (
        <div className="vd-stack vd-stack--tight">
          <span className="vd-label"><EyeOff size={11} /> What you alone know</span>
          {secrets.map((s, i) => (
            <div key={i} className="vd-tile">
              <Eye size={13} color="var(--vd-brass)" />
              {s.kind === "ambush" ? (
                <>
                  {s.subjectName} played
                  <span
                    className="vd-tile__meta"
                    style={{ color: s.card === "fail" ? "var(--vd-red-ink)" : "var(--vd-brass)" }}
                  >
                    {s.card === "fail" ? "Fail" : "Success"}
                  </span>
                </>
              ) : (
                <>
                  {s.subjectName} is
                  <span
                    className="vd-tile__meta"
                    style={{ color: s.team === "evil" ? "var(--vd-red-ink)" : "var(--vd-brass)" }}
                  >
                    {s.team === "evil" ? "against you" : "with you"}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ----------------------------- public log ------------------------- */}
      {(plots?.log.length ?? 0) > 0 && (
        <div className="vd-stack vd-stack--tight">
          <span className="vd-label vd-label--dim">Plots played</span>
          {plots!.log.map((l, i) => (
            <p key={i} className="vd-voice" style={{ margin: 0, fontSize: 13 }}>
              {l.byName} played <b>{plotName(l.card)}</b>
              {l.targetName ? ` on ${l.targetName}` : ""}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
