/* ============================================================================
   The character card — the app's one way of showing a character.

   Three modes, one design:

     flip    the whole card is a button; pressing it turns it over to the plain
             explanation. Used wherever the game is TEACHING a character.
     select  the card IS the control — the lobby's role switches. Front only,
             `aria-pressed`, and one tap is one toggle: nothing to flip, because
             a card that both selects and flips makes every tap a guess.
     static  no interaction at all. Used during play, where a card is there to
             be recognised and nothing more.

   The modes exist so that no screen has to reimplement the card, and so the
   flip never turns up somewhere a tap already means something else.

   Note for the night screen: this component renders the role it is given, the
   moment it is given it. Keeping a role out of the DOM until a hold lands is
   the caller's job — mount the card, do not hide it.
   ========================================================================== */

import { useState } from "react";
import { Eye, Flame, RotateCcw, Sun } from "lucide-react";
import { castOf, type Character, type CharacterSource } from "./characters";

/**
 * lg  the only size a card may FLIP at. A back holds four short blocks, which
 *     is about twelve lines of text in a phone-width column — `md` is 152px
 *     wide on a desktop grid and cannot hold that, so a flipping `md` card
 *     puts half its explanation behind a scrollbar.
 * md  setup switches and the night reveal: front only.
 * sm  recognition beside a paragraph, or a row of many: front only, no frame.
 */
export type CardSize = "lg" | "md" | "sm";
export type CardMode = "flip" | "select" | "static";

export type CharacterCardProps = {
  character: Character;
  size?: CardSize;
  mode?: CardMode;
  /** What the two sides are called in this world. Falls back to Good / Evil. */
  teams?: { good: string; evil: string };
  /**
   * Replaces the name on the front. The reckoning uses it to lead with the
   * PLAYER's name and put the character's name in `subtitle` beneath — at that
   * moment the table wants "who was Amber", not "here is Merlin".
   */
  title?: string;
  /**
   * Replaces the character's tagline on the front. The lobby uses it to keep
   * saying exactly what an option costs the table, which is what a host needs
   * at that moment and is not a property of the character.
   */
  subtitle?: string;
  /** Top-right state chip: "On", "Paid", "No room". */
  badge?: { label: string; icon?: React.ReactNode; tone?: "plain" | "on" };
  selected?: boolean;
  disabled?: boolean;
  /** Hide the "always in the game / optional" small print. */
  hideNote?: boolean;
  /**
   * Draw the portrait and its frame, and nothing else.
   *
   * For the night reveal, where the column beside the card already carries the
   * side and the name at reveal scale. With the plate on, the player read
   * their own name twice and their own side twice in the space of four lines.
   */
  showPlate?: boolean;
  onSelect?: () => void;
  className?: string;
};

export function CharacterCard({
  character: c,
  size = "md",
  mode = "flip",
  teams,
  title,
  subtitle,
  badge,
  selected = false,
  disabled = false,
  hideNote = false,
  showPlate = true,
  onSelect,
  className = "",
}: CharacterCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [art, setArt] = useState<{ src?: string; loaded: boolean; failed: boolean }>(
    { src: c.image, loaded: false, failed: false },
  );

  // The flags describe one URL. A world can change under a mounted card — the
  // host switching the setting in the lobby — and a verdict carried over from
  // the previous portrait would leave the new one invisible.
  const shown = art.src === c.image ? art : { src: c.image, loaded: false, failed: false };

  const evil = c.team === "evil";
  const sideName = evil ? (teams?.evil ?? "Evil") : (teams?.good ?? "Good");
  // A world with no art, and a portrait that would not load, are the same thing
  // as far as the card is concerned: draw the engraved face and carry on.
  const showArt = Boolean(c.image) && !shown.failed;
  const canFlip = mode === "flip";
  if (import.meta.env.DEV && canFlip && size !== "lg") {
    console.warn(
      `CharacterCard: "${c.id}" flips at size "${size}". Only "lg" is tall ` +
      `enough for a back — anything smaller hides half of it behind a scroll.`,
    );
  }
  // A small card has no room for a tagline it was not asked to show — but a
  // caller that hands one over is naming the card, and that always shows.
  const taglineText = subtitle ?? (size === "sm" ? null : c.tagline);

  const classes = [
    "cc",
    `cc--${size}`,
    evil ? "cc--evil" : "cc--good",
    mode !== "static" ? "cc--btn" : "",
    flipped ? "is-flipped" : "",
    selected ? "is-selected" : "",
    className,
  ].filter(Boolean).join(" ");

  const front = (
    <span className="cc__face cc__face--front" aria-hidden={flipped || undefined}>
      <span className="cc__art">
        {/* Always drawn, so there is never a hole: it is what you see while a
            portrait arrives, if it never arrives, and in the worlds that have
            no portraits at all. `aria-hidden` because it is decorative either
            way — the name is directly below it, or beside the card — and read
            aloud it was a stray letter in the middle of the page. */}
        <span className="cc__plate-art" aria-hidden>
          <span className="cc__monogram">{c.monogram}</span>
        </span>
        {showArt && (
          <img
            src={c.image}
            alt=""
            loading="lazy"
            decoding="async"
            width={1024}
            height={1536}
            style={{ opacity: shown.loaded ? 1 : 0 }}
            onLoad={() => setArt({ src: c.image, loaded: true, failed: false })}
            onError={() => setArt({ src: c.image, loaded: false, failed: true })}
          />
        )}
      </span>

      {showPlate && <span className="cc__scrim" aria-hidden />}
      <span className="cc__corners" aria-hidden><i /></span>

      {badge && (
        <span
          className={
            badge.tone === "on"
              ? `cc__badge ${evil ? "cc__badge--evil-on" : "cc__badge--on"}`
              : "cc__badge"
          }
        >
          {badge.icon}
          {badge.label}
        </span>
      )}

      {showPlate && (
      <span className="cc__plate">
        <span className="cc__side">
          {evil ? <Flame size={10} /> : <Sun size={10} />} {sideName}
        </span>
        <span className="cc__name">{title ?? c.name}</span>
        {taglineText && <span className="cc__tagline">{taglineText}</span>}
        {!hideNote && size !== "sm" && !subtitle && (
          <span className="cc__note">{c.availabilityNote}</span>
        )}
        {canFlip && (
          <span className="cc__hint">
            <Eye size={11} /> Tap to read
          </span>
        )}
      </span>
      )}
    </span>
  );

  const back = canFlip ? (
    <span className="cc__face cc__face--back" aria-hidden={!flipped || undefined}>
      <span className="cc__back">
        {/* One line, not a second title block: you arrived here by turning over
            a card whose name you have just read. */}
        <span className="cc__backhead">
          <span className="cc__backname">{c.name}</span>
          <span className="cc__side">
            {evil ? <Flame size={10} /> : <Sun size={10} />} {sideName}
          </span>
        </span>

        {c.what && <Block label="What they are" text={c.what} />}
        {c.job && <Block label="Your job" text={c.job} />}
        {c.shown && <Block label="You are shown" text={c.shown} />}
        {c.watch && <Block label="Watch out" text={c.watch} warn />}
        {/* No lore here on purpose. It is a paragraph of flavour, and a
            paragraph is what pushed the useful half of this face behind a
            scrollbar. It no longer runs anywhere: the night reveal dropped it
            too, so `Character.lore` is carried but unrendered. */}

        <span className="cc__return">
          <RotateCcw size={11} /> Tap to go back
        </span>
      </span>
    </span>
  ) : null;

  const inner = (
    <span className="cc__inner">
      {front}
      {back}
    </span>
  );

  if (mode === "static") {
    return <div className={classes}>{inner}</div>;
  }

  return (
    <button
      type="button"
      className={classes}
      disabled={disabled}
      aria-pressed={mode === "select" ? selected : undefined}
      aria-expanded={canFlip ? flipped : undefined}
      onClick={() => {
        if (canFlip) setFlipped((f) => !f);
        onSelect?.();
      }}
    >
      {inner}
    </button>
  );
}

function Block({
  label, text, warn = false,
}: { label: string; text: string; warn?: boolean }) {
  return (
    <span className={`cc__block ${warn ? "cc__block--warn" : ""}`}>
      <span className="cc__blocklabel">{label}</span>
      <span className="cc__blocktext">{text}</span>
    </span>
  );
}

/* ============================================================================
   The gallery — the whole cast of one world, split by side.

   Good first, then evil, each behind a heading that names the side in this
   world's own words. Splitting them is the point: "which side is this one on"
   is the question a new player asks of every character, and a heading answers
   it before they have to read a single card.
   ========================================================================== */

export function CharacterGallery({
  source,
  size = "lg",
  className = "",
}: {
  source: CharacterSource;
  size?: CardSize;
  className?: string;
}) {
  const cast = castOf(source);
  const teams = { good: source.goodTeamName, evil: source.evilTeamName };
  const sides = [
    { key: "good" as const, label: source.goodTeamName, icon: <Sun size={14} /> },
    { key: "evil" as const, label: source.evilTeamName, icon: <Flame size={14} /> },
  ];

  return (
    <div className={`cc-cast ${className}`}>
      {sides.map((side) => {
        const members = cast.filter((c) => c.team === side.key);
        if (members.length === 0) return null;
        return (
          <section key={side.key} className="cc-cast__side">
            <header className="cc-cast__head">
              <span
                className={`vd-label ${side.key === "good" ? "vd-label--brass" : ""}`}
                style={side.key === "evil" ? { color: "var(--vd-red-ink)" } : undefined}
              >
                {side.icon} {side.label}
              </span>
              <span className="cc-cast__count">
                {members.length} characters · tap any card to read what it does
              </span>
            </header>
            <div className={`cc-grid${size === "md" ? " cc-grid--md" : ""}`}>
              {members.map((c) => (
                <CharacterCard key={c.id} character={c} size={size} mode="flip" teams={teams} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
