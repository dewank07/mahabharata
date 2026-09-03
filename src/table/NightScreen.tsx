/* ============================================================================
   02 · The night — your role.

   One studded card, held close to the chest: press and hold to see it, never a
   tap toggle, because the phone is in your hand in a room full of people.

   NOTHING on the card may depend on the role until the hold lands — not the
   name, not the side, and above all not the colour. A red border on an unheld
   card told the whole table who the traitors were from across the room.
   Below it the full NIGHT_ORDER script with your own step struck in brass —
   knowing *when* you were shown something is part of the game.
   ========================================================================== */

import { Eye, EyeOff, Sword } from "lucide-react";
import { Studded } from "./TableShell";
import { NamePlate, RoleBrief } from "./Parts";
import { useHold } from "./RoleReveal";
import type { TableProps } from "./types";

export function NightScreen({
  room, pid, theme, act, onBegin,
}: Pick<TableProps, "room" | "pid" | "theme" | "act"> & {
  onBegin: () => Promise<unknown>;
}) {
  const { held, start, end, onKeyDown, onKeyUp } = useHold();
  const me = room.me;
  const isHost = room.hostId === pid;
  const watching = room.seating.iAmWatching;

  const roleDef = me?.role
    ? room.theme.roles.find((r) => r.id === me.role)
    : null;
  const evil = me?.team === "evil";
  const myStep = me?.nightStep ?? 0;

  // Only list steps whose role could actually be in this game.
  const steps = room.nightOrder.filter((s) => {
    if (s.step === 2) return room.opts.guinevere === true;
    if (s.step === 4) return room.opts.percival === true;
    if (s.step === 5) return room.opts.lovers === true;
    return true;
  });

  return (
    <div className="vd-table vd-table-layout">
      <div className="vd-stack">
        <div className="vd-label">Your secret role</div>
        <p className="vd-voice">
          Everyone has just been dealt a role. Press and hold your card to read
          it — let go and it hides again, so nobody can read it over your
          shoulder.
        </p>
        <p className="vd-hint" style={{ margin: 0 }}>
          You only get shown this once, so read it properly now. You can check
          it again later with the <b>Show my role</b> button at the top.
        </p>
      </div>

      <div className="vd-centre">
        <div className="vd-centre__wide">
          {watching ? (
            <Studded className="vd-role">
              <div className="vd-role__side">Watching this round</div>
              <div className="vd-role__hidden">No role</div>
              <p className="vd-voice" style={{ margin: 0 }}>
                You don't have a place in this game yet, so you weren't dealt a
                role. You can watch the board and follow along, and you'll be
                given a place as soon as one frees up.
              </p>
            </Studded>
          ) : (
            <Studded className={`vd-role ${held && evil ? "vd-role--evil" : ""}`}>
              <div className="vd-role__side">
                {held
                  ? evil
                    ? `You are EVIL · ${theme.evilTeamName}`
                    : `You are GOOD · ${theme.goodTeamName}`
                  : "Your role · hidden"}
              </div>

              {held ? (
                <>
                  <div className="vd-role__name">{roleDef?.name ?? "—"}</div>
                  <RoleBrief room={room} />
                  <p className="vd-lore" style={{ marginTop: 14 }}>{roleDef?.desc}</p>

                  <div style={{ marginTop: 16 }}>
                    <span className="vd-label">
                      {roleDef?.knowledgeLabel ?? "You are shown nothing."}
                    </span>
                    {(me?.known.length ?? 0) > 0 && (
                      <div className="vd-row" style={{ marginTop: 10 }}>
                        {me!.known.map((nm) => (
                          <NamePlate key={nm}>{nm}</NamePlate>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="vd-role__hidden">— — —</div>
                  <p className="vd-voice" style={{ margin: 0 }}>
                    Press and hold the button below to see which side you're on.
                  </p>
                </>
              )}

              <button
                className={`vd-hold ${held ? "is-holding" : ""}`}
                type="button"
                onPointerDown={start}
                onPointerUp={end}
                onPointerCancel={end}
                onKeyDown={onKeyDown}
                onKeyUp={onKeyUp}
                onBlur={end}
                onContextMenu={(e) => e.preventDefault()}
              >
                {held ? <Eye size={15} /> : <EyeOff size={15} />}
                {held ? "Let go to hide it" : "Press and hold to see your role"}
              </button>
            </Studded>
          )}
        </div>

        <div className="vd-centre__wide vd-actionbar">
          {isHost ? (
            <>
              {/* There's no way to tell who has actually held their card yet
                  — unlike Vote and Quest, which both count a real
                  submission, that would need a new server field this pass
                  doesn't add. A reminder in place of a live count still sets
                  the right expectation before a screen that can't be replayed. */}
              <p className="vd-voice" style={{ marginBottom: 10 }}>
                Check out loud that everyone has read their role before you
                carry on. This screen can't be shown again for someone who
                missed it.
              </p>
              <button className="vd-btn vd-btn--primary" onClick={act(onBegin)}>
                <span>Everyone's read it — start round 1</span>
                <Sword size={16} />
              </button>
            </>
          ) : (
            <div className="vd-panel">
              <p className="vd-voice" style={{ margin: 0 }}>
                Read your role. The host starts the first round once everyone
                has — say so when you're done.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="vd-stack">
        <span className="vd-label">Who was shown what</span>
        <p className="vd-hint" style={{ margin: 0 }}>
          Roles are revealed in this fixed order. Knowing <i>when</i> you were
          shown something is part of the game.
        </p>
        <div>
          {steps.map((s) => {
            // Each step belongs to exactly one role — 3 is Merlin, 4 Percival,
            // 2 Guinevere, 5 a lover, 1 the evil table. So marking YOUR step
            // names your role outright. It waits for the hold like everything
            // else on this screen; the script itself is public and stays.
            const mine = held && s.step === myStep;
            return (
              <div key={s.step} className={`vd-script__row ${mine ? "is-mine" : ""}`}>
                <span className="vd-script__n">{s.step}</span>
                <span className="vd-script__text">{s.label}</span>
                {mine && <span className="vd-script__you">This was you</span>}
              </div>
            );
          })}
        </div>
        {!held && !watching && (
          <p className="vd-voice" style={{ margin: 0 }}>
            Hold your card to see which of these steps was yours.
          </p>
        )}
        {/* "No vision is yours" is itself a tell — it rules out Merlin,
            Percival, Guinevere, the lovers and the evil table in one line. */}
        {held && myStep === 0 && !watching && (
          <p className="vd-voice" style={{ margin: 0 }}>
            None of these was yours — you weren't shown anything. You'll have
            to work it out from the conversation.
          </p>
        )}
      </div>
    </div>
  );
}
