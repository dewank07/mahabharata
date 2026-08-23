# Handoff: Verdict — the Council Seal system

## Overview

A full visual redesign of Verdict (social deduction, Avalon rules) covering the whole
game loop: lobby → night reveal → propose → vote → quest → Lady of the Lake →
assassination → the reckoning. It replaces the current dark-fantasy-gradient look with a
**premium board-game interface**: blackened surfaces with paper grain, aged brass rules,
parchment for the things you act on. No gradients, no glow, no shadows anywhere.

Target codebase: `dewank07/mahabharata` (Vite + React + TypeScript + Convex).
Rules, phases and constants below are taken from that repo's `convex/logic.ts` and
`convex/schema.ts` — the redesign needs **no backend changes** except the seating rule in
§ "15-player edge case".

## About the design files

`design-references/` contains the design **prototypes** — HTML documents that show the
intended look, layout and states. They are references, not production code: recreate them
in the app's existing React + CSS environment using the starter code in `src/`.

Open them in a browser directly (they are self-contained apart from the sibling
`support.js` and `public/` folder that ship alongside them).

- `Verdict Council Seal Flow.dc.html` — **the spec.** Every screen, mobile (390×844) and
  desktop (1240×760), with annotations.
- `Verdict Table Directions.dc.html` — how the system was arrived at (directions 1a–5a).
  Useful context; ignore everything except turn 5 if you only want the final language.

## Fidelity

**High-fidelity.** Colours, type, spacing, borders and states are final and are listed
below and encoded in `src/seal.css`. Match them exactly. Anything not specified (loading
skeletons, toasts, error copy) should be built from the same tokens and the same rules:
1px borders, flat fills, brass for state, no shadows.

---

## Starter code in this bundle

| File | What it is |
| --- | --- |
| `src/seal.css` | The whole design system: tokens, board, typography, panels, controls, seal, chronicle, plates, layout. Import once after your existing `styles.css`. |
| `src/sigils.tsx` | The 10 heraldic marks that replace avatars, plus deterministic per-player assignment (`dealSigils`). |
| `src/CouncilSeal.tsx` | The engraved ring of seats. One component for every phase — pass a different `state` per seat. |
| `src/TableParts.tsx` | `ClockFuse`, `QuestLadder`, `RejectionTrack`, `Chronicle`, `Plate` (overlay). |
| `src/seating.ts` | The 10-seat / watcher-queue split for over-capacity rooms. Pure functions — safe to also import from `convex/`. |
| `src/ProposeScreen.tsx` | Worked example composing all of the above for the `propose` phase. Every other phase is the same shell with a different centre column. |
| `src/assets/emblem.png` | The gold mandala, used as the seal centre and as the page watermark. |

These are written against the repo's real data shapes (`rooms`, `players`, `questResults`,
`proposedTeam`, `rejectCount`, `discussEndsAt`). Swap `RoomView` in `ProposeScreen.tsx`
for your actual Convex query result.

---

## Design tokens

### Colour

| Token | Hex | Use |
| --- | --- | --- |
| `--vd-bg` | `#131110` | the board |
| `--vd-bg-raised` | `#191612` | idle seat face |
| `--vd-bg-token` | `#1b1814` | leader seat face |
| `--vd-bg-plate` | `#161311` | overlay plate |
| `--vd-rule-structure` | `#221e19` | column dividers |
| `--vd-rule-container` | `#2b2620` | panel borders, section rules |
| `--vd-rule-control` | `#342f26` | control borders, segmented groups |
| `--vd-rule-strong` | `#4c4234` | emphasised containers |
| `--vd-rule-engraved` | `#453c2f` | engraved marks on the seal |
| `--vd-ink` | `#efe7d5` | primary text |
| `--vd-ink-soft` | `#a89e90` | body / chronicle |
| `--vd-ink-muted` | `#8b8170` | labels |
| `--vd-ink-dim` | `#6d6458` | tertiary, disabled |
| `--vd-ink-faint` | `#5f574b` | inscriptions |
| `--vd-brass` | `#c2a55f` | rules, ticks, studs, active state |
| `--vd-brass-edge` | `#b39a5c` | brass border on parchment |
| `--vd-parchment` | `#e9e1cf` | primary action + named tokens |
| `--vd-parchment-2` | `#e0d7c4` | sigil ink on dark |
| `--vd-red` | `#9e3b28` | rejection / fail / evil |
| `--vd-red-ink` | `#b5442e` | red text |
| `--vd-red-rule` | `#4a2620` | red container border |
| `--vd-green` | `#5b7f6e` | voice-connected dot only |

**Rules of use, in priority order.** Brass is never a large fill and never glows — it is a
1px rule, a tick, a 9px stud, or the fill of exactly one active segment. Parchment is a
material, not a colour: it marks what you can act on (the primary button, the riders, the
role card faces). Red means exactly two things — rejected, or evil. Everything else is ink
on charcoal.

### Type

| Role | Family | Spec |
| --- | --- | --- |
| Display / numerals | **Cinzel** 500 | h1 27px/1.1 · h2 24px/1.12 · clock 52px (38px mobile), `tabular-nums`, `letter-spacing .02em` |
| The game's voice | **EB Garamond** 400 italic | 15px/1.55 (14px mobile), `text-wrap: pretty` |
| Labels + data | **Manrope** 600/700 | 8.5px, `letter-spacing .26em`, uppercase; data 10.5–13px |

Hierarchy is carried entirely by size, weight, tracking and case — never by effects. Cinzel
is only ever a heading or a numeral; never use it for data or body copy.

### Space, borders, shadow

- 4px base scale: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40.
- Borders are always exactly 1px, in one of the five rule colours above.
- **Border radius: 0** everywhere except tokens/sigil discs (`50%`).
- **Shadows: none.** If something needs to feel raised, it becomes parchment.
- Minimum tap target 44px; the primary button is 56px.

### Texture

Two layers, both essentially subliminal:

1. Paper grain — a 140×140 `feTurbulence` SVG data-URI tiled at **5% opacity**
   (`.vd-board::before` in `seal.css`).
2. Emblem watermark — `emblem.png` at **5% opacity**, `mix-blend-mode: screen`, centred
   behind the content.

No painted background art on gameplay screens. Theme art (`public/*_bg.png`) is reserved
for reveal moments only.

---

## The council seal

The hero object. `.vd-seal` is a square box; everything inside is positioned in percentages
so one component serves 5–10 seats at any size.

- **Double rule**: outer ring `inset 8.7%`, inner ring `inset 12.5%`, both 1px.
- **Eight engraved marks** at 30° 60° 120° 150° 210° 240° 300° 330°: 1px × 10px in
  `--vd-rule-engraved`, drawn as a rotated full-size wrapper containing a bar.
- **Three brass ticks** at 90° 180° 270°: 1px × 18px in `--vd-brass`. The fourth cardinal
  (0°, top) is deliberately empty — that seat belongs to the seal-bearer.
- **Centre**: the emblem at 34% width, 32% opacity, `mix-blend-mode: screen`. Nothing else
  goes in the centre. (An earlier iteration put the quest numeral and the named count
  there; both were moved out — numeral to the quest plate, count to the line above the
  button — because they crowded the seal and duplicated information.)
- **Seats** sit at radius 42% starting at −90° and running clockwise, matching
  `players.seat` order. Disc 62px desktop / 44px mobile.

### Seat states

| State | Face | Border | Sigil | Extra |
| --- | --- | --- | --- | --- |
| idle | `#191612` | `#3a342b` | `#7b7266` | — |
| leader | `#1b1814` | `--vd-brass` | `--vd-parchment-2` | inner 1px ring at `inset 4px`; 22×2px brass bar under the disc |
| named / riding | `--vd-parchment` | `--vd-brass-edge` | `--vd-red` | inner keyline `rgba(23,20,16,.18)`; 9px brass stud at top-centre |
| voted | idle face | `--vd-brass` | idle | brass border only — never reveals which way |
| spent (Lady used) | idle face | `--vd-rule-container` | idle | 50% opacity, not selectable |

Focus ring: 2px `--vd-brass`, `outline-offset: 3px`.

---

## Screens

Each is described against `design-references/Verdict Council Seal Flow.dc.html`; open it
side by side. Desktop grid is `288px | 1fr | 274px` with 1px structural dividers, collapsing
to a single column under 1100px.

### 01 · Lobby (`phase: "lobby"`)
Seal fills with ten seats showing Roman seat numbers; right column holds the watcher queue,
roles in play, and expansions. Blocked start shows `validateSetup()`'s message **verbatim**
in a `--vd-red-rule` panel; the start button stays present but disabled. Free vs premium
options follow `FREE_OPT_KEYS` / `PREMIUM_OPT_KEYS`.

### 02 · The night (`phase: "reveal"`)
One studded role card (brass studs for good, red for evil) with the role name in Cinzel 34px
and the ability sentence in Garamond italic. Below it, the full `NIGHT_ORDER` script with
your own step highlighted (`rgba(194,165,95,.07)` row, brass numeral, `YOU` tag) — knowing
*when* you were shown something is part of the game. Names you learn are parchment plates,
never plain text.

### 03 · Propose (`phase: "propose"`)
The reference screen. Left: quest plate + title + ladder + rejection track + oath. Centre:
clock fuse, seal, `NAMED · III OF III` line, primary button. Right: chronicle. Tapping a
seat toggles it into `proposedTeam`; the button enables only at exactly `QUEST_SIZES[n][q]`.
Clock: `DISCUSS_MS` 3:00 then `SELECT_MS` 1:00.

### 04 · Vote (`phase: "vote"`) and verdict
Riders shown as three parchment cards; a 5-column grid of seats where a **brass stud means
a vote is in**, never which way. Approve is parchment, Reject is a red-outlined ghost, both
62px, side by side. The verdict arrives as a studded overlay `Plate`: counts in Cinzel 34px,
who rejected as chips, then the rejection track advances. A tie is a rejection.

### 05 · Quest (`phase: "quest"`)
Only riders see the choice; the engine clamps it (`allowedQuestCards`). Two 230px cards:
Success is parchment, Fail is a red-outlined ghost. When `failsNeeded === 2` a red panel
says so before cards go in. The result plate shows **card backs, not hands** — five slots,
the failed ones filled red.

### 06 · Lady of the Lake (`phase: "lady"`, 7+)
A 2-up grid of eligible targets; anyone in `ladyHistory` is rendered at 50% and disabled with
the reason named in the caption. Result is private; the table only ever sees that you looked.

### 07 · Assassination (`phase: "assassin"`)
Full-width: three-column grid of good-side candidates as bordered plates, the named one in
red. Right column recaps what the table publicly knows. If the lovers are in play, add a
mode switch for `assassinMode: "merlin" | "lovers"` and require two picks.

### 08 · The reckoning (`phase: "end"`)
`winReason` as the sentence under the outcome, the five-quest board, then all seats in order
with their role — evil rows tinted `rgba(158,59,40,.07)`, Merlin's row in brass.

---

## 15-player edge case

`MAX_PLAYERS = 10`, so a room holding 15 is a real state rather than an error.

- The first ten by `players.seat` are **seated**; the rest are **watchers** in a stable queue.
- Watchers see the board and hear voice, and never receive a role.
- When a seat empties, the first watcher is promoted automatically.
- The host may seat a specific watcher (swap).
- Copy offers "split the room" — spinning up a second table — as the way to seat everyone.

Client-side logic is in `src/seating.ts`. Server-side, the only change is to stop rejecting
joins past ten in the join mutation, and to run the promote/swap patches; `buildRoles` and
`validateSetup` keep operating on the **seated ten** only.

---

## Interactions & behaviour

- **Reveal your role**: press-and-hold, never a tap toggle — phones are held close in a room
  of people. 600ms hold, release to hide.
- **Selecting riders**: tap a seat; the token flips to parchment. Over-selection is prevented
  by disabling unselected seats once the party is full (rather than silently swapping).
- **Timers**: re-render once per second; ticks go dark in whole steps. No animation, no
  pulsing, no colour change at the end — the count of dark ticks is the urgency.
- **Simultaneity**: votes and quest cards are hidden until all are in; the only public
  intermediate state is *that* a player has acted.
- **Transitions**: 120ms linear on background-colour for buttons; nothing else moves.
  Everything respects `prefers-reduced-motion`.
- **Overlays**: `role="dialog" aria-modal="true"`, dismiss on the explicit action only —
  never on backdrop click, since a mis-tap would skip a result the table is reading.

## State

No new server state beyond the seating change. Client-side state:

| State | Source |
| --- | --- |
| `phase`, `questIndex`, `questResults`, `rejectCount`, `proposedTeam`, `leaderIndex` | `rooms` |
| `players[]` with `seat`, `inVoice`, `role` | `players` |
| seating split (`seated`, `watching`) | derived, `seating.ts` |
| sigil per player | derived from `playerId`, `dealSigils()` — or persist as `players.sigil` if you want it fixed across sessions |
| `oathRevealed` (hold-to-see) | local component state, never persisted |
| clock `now` | local `setInterval`, 1s |

## Assets

- `src/assets/emblem.png` — the gold mandala supplied by the client. Used at 34% inside the
  seal (32% opacity) and as the page watermark (5%). Ships in the bundle.
- Theme backgrounds already in the repo (`public/medieval_bg.png` etc.) — **not** used on
  gameplay screens in this system; keep them for reveal moments and marketing.
- Fonts: Cinzel, EB Garamond, Manrope (Google Fonts). Self-host for production; `seal.css`
  currently `@import`s them.

## Suggested order of work

1. Add `seal.css` and the emblem; convert one screen (propose) end-to-end.
2. Extract `CouncilSeal` + `TableParts` and reuse across vote / lobby / end.
3. Do the overlay plates (verdict, quest result) — they are the highest-drama moments.
4. Night reveal and assassination.
5. Seating change (server) + lobby watcher queue.
