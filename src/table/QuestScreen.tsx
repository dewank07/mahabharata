/* ============================================================================
   05 · On the quest, and what came back.

   Only riders see the choice, and the engine clamps it (`allowedQuestCards`):
   good may only succeed, the Evil Lancelot may only fail. The result is
   anonymous by design — the count of fails, never the hands.
   ========================================================================== */

import { Check, Eye, Sword, X } from "lucide-react";
import { Plate } from "../TableParts";
import { QuestColumn, ChronicleColumn, SeatRing } from "./Parts";
import { ActionLine } from "./TableShell";
import { Riders } from "./ProposeScreen";
import { type TableProps, ROMAN, nameOf } from "./types";

export function QuestScreen({
  room, pid, emblemSrc, act, onCard,
}: Pick<TableProps, "room" | "pid" | "emblemSrc" | "act"> & {
  onCard: (card: "success" | "fail") => Promise<unknown>;
}) {
  const onTeam = room.proposedTeam.includes(pid);
  const played = room.questProgress.iSubmitted;
  const allowed = room.me?.allowedCards ?? ["success"];
  const canSucceed = allowed.includes("success");
  const canFail = allowed.includes("fail");
  const forced = allowed.length === 1;

  return (
    <div className="vd-table vd-table-layout">
      <QuestColumn room={room} />

      <div className="vd-centre">
        <div className="vd-centre__wide">
          <Riders room={room} />
        </div>

        <SeatRing
          room={room}
          emblemSrc={emblemSrc}
          stateFor={(p) => (room.proposedTeam.includes(p.playerId) ? "named" : "idle")}
          noteFor={(p) => (room.proposedTeam.includes(p.playerId) ? "Riding" : undefined)}
        />

        <div className="vd-centre__wide vd-actionbar">
          {room.failsNeeded > 1 && (
            <div className="vd-panel vd-panel--danger" style={{ marginBottom: 12 }}>
              <p className="vd-voice" style={{ margin: 0, color: "var(--vd-red-ink)" }}>
                Quest {ROMAN[room.questIndex]} needs <b>two fails</b> to sink.
              </p>
            </div>
          )}

          {!onTeam ? (
            <>
              <ActionLine
                label="The party rides"
                value={`${room.questProgress.submitted} of ${room.questProgress.total} in`}
              />
              <div className="vd-panel">
                <p className="vd-voice" style={{ margin: 0 }}>
                  You did not ride. What they do out there is theirs alone.
                </p>
              </div>
            </>
          ) : played ? (
            <>
              <ActionLine label="Deed sealed" value={`${room.questProgress.submitted} of ${room.questProgress.total}`} />
              <div className="vd-panel">
                <p className="vd-voice" style={{ margin: 0 }}>
                  Your card is face down with the others.
                </p>
              </div>
            </>
          ) : (
            <>
              <ActionLine label="Commit your deed" />
              <div className="vd-cards">
                <button
                  className="vd-card vd-card--success"
                  disabled={!canSucceed}
                  onClick={act(() => onCard("success"))}
                >
                  <Check size={20} />
                  <span className="vd-card__name">Succeed</span>
                  <span className="vd-card__note">the quest holds</span>
                </button>
                <button
                  className="vd-card vd-card--fail"
                  disabled={!canFail}
                  onClick={act(() => onCard("fail"))}
                >
                  <X size={20} />
                  <span className="vd-card__name">Fail</span>
                  <span className="vd-card__note">sabotage it</span>
                </button>
              </div>
              {forced && (
                <p className="vd-voice" style={{ marginTop: 11 }}>
                  {canFail
                    ? "Your oath binds you — you can only sabotage this quest."
                    : "Those sworn to the light may only succeed."}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <ChronicleColumn room={room} />
    </div>
  );
}

/**
 * 05b · Excalibur / the sealed-cards window. Every card is in but not yet
 * turned over: the bearer may flip one, and an Ambush can still peek.
 */
export function ExcaliburScreen({
  room, pid, act, onUse, onSeal,
}: Pick<TableProps, "room" | "pid" | "act"> & {
  onUse: (targetId?: string) => Promise<unknown>;
  onSeal: () => Promise<unknown>;
}) {
  const holderId = room.excalibur?.holderId ?? null;
  const armed =
    room.opts.excalibur === true && holderId != null && room.proposedTeam.includes(holderId);
  const mine = armed && holderId === pid;

  if (!armed) {
    return (
      <Plate
        eyebrow="The deeds are sealed"
        title="Turn the cards over"
        action={
          <button className="vd-btn vd-btn--primary" onClick={act(onSeal)}>
            <span>Turn the cards over</span>
          </button>
        }
      >
        <p className="vd-voice" style={{ marginTop: 14, textAlign: "center" }}>
          Every card is in but none is face up. Play an Ambush now if you hold one.
        </p>
      </Plate>
    );
  }

  if (!mine) {
    return (
      <Plate eyebrow="Excalibur is drawn" title={nameOf(room, holderId)}>
        <p className="vd-voice" style={{ marginTop: 14, textAlign: "center" }}>
          The bearer is weighing the blade over the sealed cards.
        </p>
      </Plate>
    );
  }

  return (
    <Plate
      eyebrow="Excalibur is yours"
      title="Turn one card?"
      action={
        <button className="vd-btn" onClick={act(() => onUse(undefined))}>
          <span>Sheathe it — change nothing</span>
        </button>
      }
    >
      <p className="vd-voice" style={{ marginTop: 14, textAlign: "center" }}>
        The table will see <i>who</i> you struck. Only the two of you will ever
        know what the card was.
      </p>
      <div className="vd-stack vd-stack--tight" style={{ marginTop: 16 }}>
        {room.proposedTeam
          .filter((id) => id !== pid)
          .map((id) => (
            <button key={id} className="vd-tile vd-tile--btn" onClick={act(() => onUse(id))}>
              <Sword size={13} color="var(--vd-brass)" /> Flip {nameOf(room, id)}
            </button>
          ))}
      </div>
    </Plate>
  );
}

/** The quest result: card backs, never hands. Failed slots filled red. */
export function QuestResultPlate({
  room, onDismiss,
}: { room: Room2; onDismiss: () => void }) {
  const q = room.lastQuest;
  if (!q) return null;
  const backs = Array.from({ length: q.size }, (_, i) => i < q.fails);

  return (
    <Plate
      eyebrow={`Quest ${ROMAN[q.questIndex] ?? ""}`}
      title={q.success ? "The quest holds" : "The quest falls"}
      danger={!q.success}
      action={
        <button className="vd-btn vd-btn--primary" onClick={onDismiss}>
          <span>Read</span>
        </button>
      }
    >
      <div className="vd-backs" style={{ marginTop: 18 }}>
        {backs.map((failed, i) => (
          <span key={i} className={`vd-back ${failed ? "is-fail" : ""}`} />
        ))}
      </div>
      <p className="vd-voice" style={{ marginTop: 16, textAlign: "center" }}>
        {q.fails === 0
          ? "Not one hand turned against it."
          : `${q.fails} card${q.fails === 1 ? "" : "s"} came back against the quest. Whose, nobody will say.`}
      </p>
      {(q.revealed ?? []).length > 0 && (
        <div className="vd-stack vd-stack--tight" style={{ marginTop: 14 }}>
          <span className="vd-label vd-label--dim">Called out by We Found You</span>
          {(q.revealed ?? []).map((r) => (
            <div key={r.playerId} className="vd-tile">
              <Eye size={13} color="var(--vd-brass)" /> {nameOf(room, r.playerId)}
              <span className="vd-tile__meta" style={{ color: r.card === "fail" ? "var(--vd-red-ink)" : "var(--vd-brass)" }}>
                {r.card === "fail" ? "Fail" : "Success"}
              </span>
            </div>
          ))}
        </div>
      )}
    </Plate>
  );
}

// Local alias so this file does not need the full TableProps for one plate.
type Room2 = TableProps["room"];
