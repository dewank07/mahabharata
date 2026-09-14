/* ============================================================================
   Pieces shared by more than one phase: the room → CouncilSeal seat mapping,
   what you are trying to do, and a parchment name plate.

   The two columns that used to live here are gone. `QuestColumn` was 288px of
   mission plate, ladder, rejection track and win conditions, three of them
   under a sentence explaining them — it is now one row, `StatusStrip`.
   `ChronicleColumn` was a permanent 274px ledger nobody reads mid-turn; it is
   the second half of the ⓘ sheet, `GameInfo`.
   ========================================================================== */

import { useMemo } from "react";
import { CouncilSeal, type Seat, type SeatState } from "../CouncilSeal";
import { Sigil, dealSigils } from "../sigils";
import { type Room, displayName } from "./types";

/**
 * Map the room onto the seal. `stateFor` decides each seat's state so one
 * component serves every phase, exactly as the design intends.
 */
export function SeatRing({
  room,
  emblemSrc,
  stateFor,
  noteFor,
  onSelect,
  isDisabled,
}: {
  room: Room;
  emblemSrc: string;
  stateFor: (p: Room["players"][number]) => SeatState;
  noteFor?: (p: Room["players"][number]) => string | undefined;
  onSelect?: (playerId: string) => void;
  isDisabled?: (seat: Seat) => boolean;
}) {
  const sigils = useMemo(
    () => dealSigils(room.players.map((p) => p.playerId)),
    [room.players.map((p) => p.playerId).join(",")], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const seats: Seat[] = room.players.map((p) => ({
    playerId: p.playerId,
    // Names are stored folded to lower case. The visible label gets its
    // capitals back from CSS, but a seat's aria-label is read out as-is —
    // "Add amber" — so the fold has to be undone here too.
    name: displayName(p.name),
    sigil: sigils[p.playerId] ?? 0,
    state: stateFor(p),
    note: noteFor?.(p),
  }));

  return (
    <CouncilSeal
      seats={seats}
      emblemSrc={emblemSrc}
      onSelect={onSelect}
      isDisabled={isDisabled}
    />
  );
}

/**
 * What you are actually trying to do, in plain words.
 *
 * Derived from your side and from `allowedCards` — not from theme copy — so
 * it stays correct across all five settings without another 65 strings to
 * write and keep in sync with the engine.
 *
 * One line, because this renders on the night card AND behind every mid-game
 * role peek. The second line — what you are allowed to play on a mission — is
 * gone except for the one case that surprises people: the quest screen greys
 * out the card you cannot play and says why, at the moment it matters.
 */
export function RoleBrief({ room }: { room: Room }) {
  const me = room.me;
  if (!me || me.isWatcher || !me.role) return null;
  const evil = me.team === "evil";
  const allowed = me.allowedCards ?? [];
  const forcedFail = allowed.length === 1 && allowed[0] === "fail";

  return (
    <div className="vd-brief">
      <span className="vd-label">Your job</span>
      <p className="vd-brief__text">
        {evil
          ? "Make missions FAIL, without being found out."
          : "Make missions SUCCEED. Work out who's lying."}
      </p>
      {/* Only the surprise stays. Everyone else learns what they may play from
          the quest screen itself, at the moment it matters. */}
      {forcedFail && (
        <p className="vd-hint">You have no choice on a mission — always Fail.</p>
      )}
    </div>
  );
}

/** A parchment name plate. The design never shows a learned name as plain text. */
export function NamePlate({ children }: { children: React.ReactNode }) {
  return <span className="vd-tile vd-tile--parchment" style={{ width: "auto" }}>{children}</span>;
}

/**
 * The people you were shown, as they appear everywhere else in the game.
 *
 * This was a row of bare names. A name is not how anyone identifies a player
 * mid-game: the seal deals every seat a sigil and a number, and that mark is
 * what "the third one round, the peak" means when you are looking at a table
 * rather than at a list. Being told "you are shown: bran, esa" and then having
 * to map two strings onto a ring of eighteen marks is work the reveal can just
 * do for you — and it is the one screen you cannot ask for again.
 *
 * The server sends NAMES (`knownNames`), and names are unique in a room —
 * `joinRoom` refuses a duplicate — so the mark is looked up by name here
 * rather than widening the room payload. A name that somehow finds no player
 * still renders, as the plain plate it always was.
 */
export function KnownPlayers({ room, names }: { room: Room; names: string[] }) {
  // Dealt once for the row, not once per plate: `dealSigils` walks the whole
  // table to keep the marks distinct, so calling it per name is quadratic for
  // an identical answer.
  const sigils = useMemo(
    () => dealSigils(room.players.map((p) => p.playerId)),
    [room.players.map((p) => p.playerId).join(",")], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="vd-row" style={{ marginTop: 9 }}>
      {names.map((nm) => {
        const p = room.players.find((x) => x.name === nm);
        if (!p) return <NamePlate key={nm}>{displayName(nm)}</NamePlate>;
        return (
          <span
            key={nm}
            className="vd-tile vd-tile--parchment vd-known"
            style={{ width: "auto" }}
          >
            {/* Ink on parchment, like the named seats on the seal. */}
            <Sigil index={sigils[p.playerId] ?? 0} size={17} color="#171410" />
            {displayName(p.name)}
            <span className="vd-known__seat">Seat {p.seat + 1}</span>
          </span>
        );
      })}
    </div>
  );
}
