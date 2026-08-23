/* ============================================================================
   07 · The last word — the assassination.

   Three quests held means good has almost won. The assassin still names Merlin,
   and if the lovers are in play may name the pair instead.
   ========================================================================== */

import { useState } from "react";
import { Flame } from "lucide-react";
import { QuestLadder } from "../TableParts";
import { QUEST_SIZES, DOUBLE_FAIL_QUEST } from "../../convex/logic";
import { ChronicleColumn } from "./Parts";
import { ActionLine } from "./TableShell";
import type { TableProps } from "./types";

export function AssassinScreen({
  room, pid, theme, act, onStrike,
}: Pick<TableProps, "room" | "pid" | "theme" | "act"> & {
  onStrike: (mode: "merlin" | "lovers", targetId: string, targetId2?: string) => Promise<unknown>;
}) {
  const amAssassin = room.me?.role === "assassin";
  const loversInPlay = room.opts.lovers === true;
  const [mode, setMode] = useState<"merlin" | "lovers">("merlin");
  const [picks, setPicks] = useState<string[]>([]);

  const roleName = (id: string) =>
    room.theme.roles.find((r) => r.id === id)?.name ?? id;
  const n = room.players.length;

  const candidates = room.players.filter((p) => p.playerId !== pid);
  const needTwo = mode === "lovers" && loversInPlay;
  const ready = needTwo ? picks.length === 2 : picks.length === 1;

  const toggle = (id: string) => {
    const limit = needTwo ? 2 : 1;
    setPicks((q) =>
      q.includes(id) ? q.filter((x) => x !== id) : q.length < limit ? [...q, id] : q,
    );
  };

  return (
    <div className="vd-table vd-table-layout">
      <div className="vd-stack">
        <div className="vd-label vd-label--dim">Three quests held</div>
        <p className="vd-voice">
          The {theme.goodTeamName} have all but won. One knife is still owed —
          name {roleName("merlin")} and it all turns over.
        </p>
        <QuestLadder
          sizes={QUEST_SIZES[n] ?? []}
          questIndex={room.questIndex}
          results={room.questResults}
          doubleFailIndex={n >= 7 ? DOUBLE_FAIL_QUEST : undefined}
        />
      </div>

      <div className="vd-centre">
        {!amAssassin ? (
          <div className="vd-centre__wide vd-studded vd-panel vd-panel--danger">
            <span className="vd-stud-b" aria-hidden />
            <div className="vd-label" style={{ color: "var(--vd-red-ink)" }}>
              The knife is out
            </div>
            <p className="vd-voice" style={{ marginTop: 12 }}>
              Somewhere in this room the Assassin is choosing. Nothing you do now
              changes it.
            </p>
          </div>
        ) : (
          <div className="vd-centre__wide vd-stack">
            {loversInPlay && (
              <div className="vd-seg">
                <button
                  className={mode === "merlin" ? "is-active" : undefined}
                  onClick={() => { setMode("merlin"); setPicks([]); }}
                >
                  <span className="vd-label" style={{ color: "inherit" }}>
                    Name {roleName("merlin")}
                  </span>
                </button>
                <button
                  className={mode === "lovers" ? "is-active" : undefined}
                  onClick={() => { setMode("lovers"); setPicks([]); }}
                >
                  <span className="vd-label" style={{ color: "inherit" }}>Name the lovers</span>
                </button>
              </div>
            )}

            <ActionLine
              label={needTwo ? "Name both lovers" : `Name ${roleName("merlin")}`}
              value={needTwo ? `${picks.length} of 2` : undefined}
            />

            <div className="vd-grid3">
              {candidates.map((p) => {
                const on = picks.includes(p.playerId);
                return (
                  <button
                    key={p.playerId}
                    className={`vd-tile vd-tile--btn ${on ? "vd-tile--evil" : ""}`}
                    onClick={() => toggle(p.playerId)}
                  >
                    <span className="vd-tile__seat">{p.seat + 1}</span>
                    {p.name}
                  </button>
                );
              })}
            </div>

            <div className="vd-actionbar">
              <button
                className="vd-btn vd-btn--danger"
                disabled={!ready}
                onClick={act(() =>
                  onStrike(needTwo ? "lovers" : "merlin", picks[0], picks[1]),
                )}
              >
                <span>{needTwo ? "Strike them both" : "Strike"}</span>
                <Flame size={16} />
              </button>
              {needTwo && (
                <p className="vd-voice" style={{ marginTop: 11 }}>
                  Both right and it is yours. Either wrong and the realm holds.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <ChronicleColumn room={room} />
    </div>
  );
}
