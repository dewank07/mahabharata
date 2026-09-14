/* ============================================================================
   The table has a sound now.

   Five cues, all synthesised here and none of them a file: the whole module is
   smaller than one mp3 would be, there is nothing to wait on before the first
   press, and a cue can never arrive late enough to land on the wrong screen.

   Everything below is in service of three rules.

   1. A CUE NEVER SAYS ANYTHING PRIVATE. `reveal` is the same two notes whether
      you turned over Krishna or Shakuni, and `seal` is the same knock for a
      success card as for a fail. A phone in a room full of people is a speaker
      pointed at your opponents, and a cue that differed by side would hand
      them your allegiance through a trouser pocket. This is the rule the rest
      of the app already keeps in the DOM — see `RoleReveal` — held in audio.

   2. SOUND IS NEVER THE ONLY CARRIER. Every cue doubles something already on
      the screen. Muted is a complete way to play, which is what makes the
      default defensible and what an autoplay policy forces anyway.

   3. IT CANNOT BREAK A TURN. Every entry point is inside a try/catch that
      swallows. There is no browser in which failing to make a noise should be
      able to stop somebody voting.

   The timbre is the design system's, not a beep's: struck brass over wood. A
   real plate rings inharmonically — partials that are not whole multiples of
   the fundamental — and decays fast, so each cue is a few detuned partials
   with a near-instant attack and an exponential tail. That is the difference
   between "a brass tack landing on a felt table" and "a notification".
   ========================================================================== */

/** The cues, in the order a game meets them. */
export type Cue =
  /** A control was pressed. The quietest thing here, and the most frequent. */
  | "tap"
  /** Something was chosen or unchosen — a seat, a role, a target. */
  | "select"
  /** A decision was committed and cannot be taken back: a vote, a quest card. */
  | "seal"
  /** A private card came up. Identical for both sides — see rule 1. */
  | "reveal"
  /** The table moved on: a new mission, the night, the reckoning. */
  | "phase";

const STORAGE_KEY = "decevia.sound";

/* ---------------------------------------------------------------- state --- */

/**
 * Default ON, because a cue that doubles the screen is an improvement the
 * first time and a preference only after that — and the mute is one press
 * away in the bar. A browser with no storage (private mode, blocked cookies)
 * just gets the default every session rather than an exception.
 */
let enabled = read();

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

/**
 * The context is created on the first GESTURE, never at import.
 *
 * Every browser refuses to start audio that no one asked for, and a context
 * built during module evaluation is born `suspended` and stays that way — so
 * the first few cues of a game would be silently dropped and only the fourth
 * or fifth would play. Building it on a real press means the first cue a
 * player triggers is also the first one they hear.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(gesture: boolean): AudioContext | null {
  try {
    if (!ctx) {
      if (!gesture) return null;
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    // Backgrounding a tab suspends the context; coming back needs a gesture to
    // resume it, and until then there is nothing to play into.
    if (ctx.state !== "running") {
      if (!gesture) return null;
      void ctx.resume().catch(() => {});
    }
    return ctx;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------ the voices --- */

type Partial_ = {
  /** Multiple of the cue's fundamental. Deliberately not whole numbers. */
  ratio: number;
  gain: number;
  /** Seconds. Higher partials die first, which is what makes it a strike. */
  decay: number;
};

type Voice = {
  hz: number;
  /** Seconds from the cue's start. A two-note cue is two voices, one delayed. */
  at: number;
  type: OscillatorType;
  partials: Partial_[];
};

/**
 * Brass, struck. The 2.76 / 5.4 ratios are roughly a bell's first two
 * inharmonic modes; rounding them to 3 and 5 would make a chord instead.
 */
const brass = (hz: number, at: number, gain: number): Voice => ({
  hz,
  at,
  type: "sine",
  partials: [
    { ratio: 1, gain: gain, decay: 0.5 },
    { ratio: 2.76, gain: gain * 0.42, decay: 0.28 },
    { ratio: 5.4, gain: gain * 0.16, decay: 0.13 },
  ],
});

/** Wood, knocked. One body tone, one click, both gone inside a tenth of a second. */
const wood = (hz: number, at: number, gain: number): Voice => ({
  hz,
  at,
  type: "triangle",
  partials: [
    { ratio: 1, gain: gain, decay: 0.075 },
    { ratio: 3.2, gain: gain * 0.3, decay: 0.03 },
  ],
});

/**
 * The score. Levels are deliberately uneven: `tap` fires on every press and
 * has to sit under the conversation in the room, while `phase` fires perhaps
 * a dozen times a game and is allowed to be heard across a table.
 */
const CUES: Record<Cue, Voice[]> = {
  tap: [wood(196, 0, 0.05)],
  select: [brass(587.33, 0, 0.045), brass(880, 0.028, 0.03)],
  seal: [wood(147, 0, 0.075), brass(392, 0.02, 0.05)],
  // A fifth, rising. The same interval for both sides — see rule 1.
  reveal: [brass(329.63, 0, 0.055), brass(493.88, 0.075, 0.05)],
  phase: [brass(261.63, 0, 0.06), brass(392, 0.1, 0.045)],
};

/* -------------------------------------------------------------- playing --- */

/**
 * Play a cue.
 *
 * Pass `gesture` from a handler that a person actually triggered — a click, a
 * pointerdown, a key press. It is what permits the context to be created or
 * resumed; a cue fired from an effect or a server update plays only if a
 * gesture already opened the context, which is exactly the right behaviour.
 */
export function play(cue: Cue, gesture = false): void {
  if (!enabled) return;
  // A backgrounded tab is a phone in a pocket. Nothing from there is wanted.
  if (typeof document !== "undefined" && document.hidden) return;

  const ac = audio(gesture);
  if (!ac || !master) return;

  try {
    const t0 = ac.currentTime;
    for (const voice of CUES[cue]) {
      for (const p of voice.partials) {
        const start = t0 + voice.at;
        const osc = ac.createOscillator();
        const gain = ac.createGain();

        osc.type = voice.type;
        osc.frequency.setValueAtTime(voice.hz * p.ratio, start);

        /* Attack is 4ms rather than 0: a gain that steps straight to full
           puts a discontinuity in the waveform, which every speaker renders
           as a click in front of the note. Release is exponential because
           linear decay sounds like a fade-out, not like something struck —
           and it never reaches 0, since exponentialRamp cannot target it. */
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(p.gain, start + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + p.decay);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + p.decay + 0.02);
        // Nodes are one-shot and are not reachable after they end; without
        // this a long game leaves a few thousand of them on the graph.
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
      }
    }
  } catch {
    /* Rule 3. A turn is worth more than a noise. */
  }
}

/* ----------------------------------------------------------------- mute --- */

export function isEnabled(): boolean {
  return enabled;
}

/**
 * Flip the mute and remember it.
 *
 * Unmuting plays `select` as its own confirmation — it is the one control in
 * the app whose effect is inaudible otherwise, so pressing it has to prove it
 * worked. It counts as a gesture, which is also what opens the context for a
 * player who muted before the first cue ever fired.
 */
export function setEnabled(next: boolean): void {
  enabled = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
  } catch {
    /* An unwritable store costs the preference, not the setting. */
  }
  if (next) play("select", true);
}

/** The subscribers are the toggles in the UI; there is normally exactly one. */
const listeners = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const notify = () => listeners.forEach((fn) => fn());

/** `setEnabled`, plus telling every mounted toggle to re-read. */
export function toggle(): void {
  setEnabled(!enabled);
  notify();
}
