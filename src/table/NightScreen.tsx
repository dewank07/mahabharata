/* ============================================================================
   02 · The night — your role.

   One studded card, held close to the chest: press and hold to see it, never a
   tap toggle, because the phone is in your hand in a room full of people.

   NOTHING on the card may depend on the role until the hold lands — not the
   name, not the side, and above all not the colour. A red border on an unheld
   card told the whole table who the traitors were from across the room.
   Below it the full NIGHT_ORDER script with your own step struck in brass —
   knowing *when* you were shown something is part of the game.

   Gone from this screen, and why:
     two paragraphs on how press-and-hold works  → the button says it
     the lore paragraph under every role         → `RoleBrief` above it is the
                                                   same thing in words you can
                                                   act on; the portrait carries
                                                   the flavour
     "Press and hold the button below…"          → sits directly above a button
                                                   reading "Press and hold to
                                                   see your role"
     "Roles are revealed in this fixed order…"   → the header now says "in
                                                   order", and /learn explains
                                                   why it matters
     "Hold your card to see which step was yours" → a third instruction to hold
                                                   the same card
   ========================================================================== */

import { Eye, EyeOff, Sword } from "lucide-react";
import { CharacterCard } from "../CharacterCard";
import { characterFor, rolesInPlay, usePreloadArt } from "../characters";
import { Studded } from "./TableShell";
import { KnownPlayers, RoleBrief } from "./Parts";
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

  const character = me?.role ? characterFor(room.theme, me.role) : null;

  /* Warm every portrait this setup could deal, so the hold lands on a painting
     instead of on its stand-in. The set is what the lobby already showed
     everyone; asking for one portrait would put your own role in the network
     log, which is exactly what the rest of this screen goes to lengths to
     avoid. */
  usePreloadArt(
    rolesInPlay(room.opts as Record<string, boolean | undefined>).map(
      (id) => characterFor(room.theme, id)?.image,
    ),
  );

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
        <p className="vd-hint" style={{ margin: 0 }}>
          Hold the card to read it — let go and it hides. You can check it again
          later with <b>Show my role</b>.
        </p>
      </div>

      <div className="vd-centre">
        <div className="vd-centre__wide">
          {watching ? (
            <Studded className="vd-role">
              <div className="vd-role__side">Watching this round</div>
              <div className="vd-role__hidden">No role</div>
              <p className="vd-hint" style={{ margin: 0 }}>
                You'll be given a place as soon as one frees up.
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
                  {/* Mounted only inside this branch, like everything else that
                      names the role: a portrait is the loudest tell there is,
                      and it must not be sitting in the DOM before the hold. */}
                  <div className="cc-reveal" style={{ marginTop: 12 }}>
                    {character && (
                      <div className="cc-reveal__card">
                        <CharacterCard
                          character={character}
                          size="md"
                          mode="static"
                          showPlate={false}
                        />
                      </div>
                    )}
                    <div className="cc-reveal__body">
                      <div className="vd-role__name" style={{ marginTop: 0 }}>
                        {roleDef?.name ?? "—"}
                      </div>
                      <RoleBrief room={room} />
                    </div>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <span className="vd-label">
                      {roleDef?.knowledgeLabel ?? "You are shown nothing."}
                    </span>
                    {(me?.known.length ?? 0) > 0 && (
                      <KnownPlayers room={room} names={me!.known} />
                    )}
                  </div>
                </>
              ) : (
                <div className="vd-role__hidden">— — —</div>
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
              <p className="vd-hint" style={{ marginBottom: 10 }}>
                Check everyone has read it — this screen can't be shown again.
              </p>
              <button className="vd-btn vd-btn--primary" onClick={act(onBegin)}>
                <span>Everyone's read it — start round 1</span>
                <Sword size={16} />
              </button>
            </>
          ) : (
            <div className="vd-panel">
              <p className="vd-voice" style={{ margin: 0 }}>
                Read your role, then tell the host you're ready.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="vd-stack">
        <span className="vd-label">Who was shown what, in order</span>
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
        {/* "No vision is yours" is itself a tell — it rules out Merlin,
            Percival, Guinevere, the lovers and the evil table in one line. */}
        {held && myStep === 0 && !watching && (
          <p className="vd-hint" style={{ margin: 0 }}>
            None of these was yours — you were shown nothing.
          </p>
        )}
      </div>
    </div>
  );
}
