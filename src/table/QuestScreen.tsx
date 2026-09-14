/* ============================================================================
   05 · On the quest, and what came back.

   Only riders see the choice, and the engine clamps it (`allowedQuestCards`):
   good may only succeed — unless the room turned on the `goodMayFail` house
   rule — and the Evil Lancelot may only fail. The result is anonymous by
   design — the count of fails, never the hands.

   Gone: the mission and ledger columns; a red panel announcing that this
   mission needs two fails, which the strip now carries as three words; two
   action lines restating the bar; and two of the three trailing hints. The
   third stayed — the one that explains why a button is greyed out is not
   tutorial copy, it is the only account of a disabled control.
   ========================================================================== */

import { Check, Eye, Sword, X } from "lucide-react";
import { Plate } from "../TableParts";
import { SeatRing } from "./Parts";
import { StatusStrip } from "./StatusStrip";
import { Riders } from "./ProposeScreen";
import { type TableProps, nameOf } from "./types";

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
  const myTurn = onTeam && !played;

  return (
    <div className="vd-play">
      <StatusStrip room={room} />
      <Riders room={room} />

      {myTurn && (
        <div className="vd-actionbar">
          <div className="vd-cards">
            <button
              className="vd-card vd-card--success"
              disabled={!canSucceed}
              onClick={act(() => onCard("success"))}
            >
              <Check size={20} />
              <span className="vd-card__name">Succeed</span>
              <span className="vd-card__note">Help this mission work</span>
            </button>
            <button
              className="vd-card vd-card--fail"
              disabled={!canFail}
              onClick={act(() => onCard("fail"))}
            >
              <X size={20} />
              <span className="vd-card__name">Fail</span>
              <span className="vd-card__note">Secretly sabotage it</span>
            </button>
          </div>
          {/* Only when one of the two above is greyed out. */}
          {forced && (
            <p className="vd-hint">
              {canFail
                ? "Your role gives you no choice — you must play Fail."
                : "Your role can only play Succeed."}
            </p>
          )}
        </div>
      )}

      <SeatRing
        room={room}
        emblemSrc={emblemSrc}
        stateFor={(p) => (room.proposedTeam.includes(p.playerId) ? "named" : "idle")}
        noteFor={(p) => (room.proposedTeam.includes(p.playerId) ? "On the team" : undefined)}
      />
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
        eyebrow="All cards are in"
        title="Ready to reveal"
        action={
          <button className="vd-btn vd-btn--primary" onClick={act(onSeal)}>
            <span>Turn the cards over</span>
          </button>
        }
      >
        {/* Only says this where an Ambush card can actually exist. */}
        {room.opts.plots === true && (
          <p className="vd-hint" style={{ textAlign: "center", marginTop: 12 }}>
            Last moment to play an Ambush card.
          </p>
        )}
      </Plate>
    );
  }

  if (!mine) {
    return (
      <Plate eyebrow="Excalibur" title={nameOf(room, holderId)}>
        <p className="vd-hint" style={{ marginTop: 12, textAlign: "center" }}>
          Deciding whether to flip a card.
        </p>
      </Plate>
    );
  }

  return (
    <Plate
      eyebrow="You have Excalibur"
      title="Flip somebody's card?"
      action={
        <button className="vd-btn" onClick={act(() => onUse(undefined))}>
          <span>Leave every card as it is</span>
        </button>
      }
    >
      <div className="vd-stack vd-stack--tight" style={{ marginTop: 16 }}>
        {room.proposedTeam
          .filter((id) => id !== pid)
          .map((id) => (
            <button key={id} className="vd-tile vd-tile--btn" onClick={act(() => onUse(id))}>
              <Sword size={14} color="var(--vd-brass)" /> Flip {nameOf(room, id)}'s card
            </button>
          ))}
      </div>
      {/* Public vs private is what makes this a decision, so it stays. */}
      <p className="vd-hint" style={{ textAlign: "center" }}>
        Everyone sees who you picked, never which card.
      </p>
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
      eyebrow={`Mission ${q.questIndex + 1} of 5`}
      title={q.success ? "Mission succeeded" : "Mission failed"}
      danger={!q.success}
      action={
        <button className="vd-btn vd-btn--primary" onClick={onDismiss}>
          <span>Continue</span>
        </button>
      }
    >
      <div className="vd-backs" style={{ marginTop: 18 }}>
        {backs.map((failed, i) => (
          <span key={i} className={`vd-back ${failed ? "is-fail" : ""}`} />
        ))}
      </div>
      <p className="vd-voice" style={{ marginTop: 14, textAlign: "center" }}>
        {q.fails === 0
          ? "Every card was a Succeed."
          : `${q.fails} of ${q.size} came back Fail.`}
      </p>
      {(q.revealed ?? []).length > 0 && (
        <div className="vd-stack vd-stack--tight" style={{ marginTop: 14 }}>
          <span className="vd-label">Revealed by a "We Found You" card</span>
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
