/* ============================================================================
   The mute, and the hook every other call site uses.

   The toggle lives in the table's bar rather than behind the ⋯ menu on
   purpose: it is the one control a player reaches for in a hurry — someone has
   walked in, or the room has gone quiet — and a setting you have to open a
   menu to find is one you turn off once, before the game, and never back on.
   ========================================================================== */

import { useCallback, useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isEnabled, play, subscribe, toggle, type Cue } from "./sound";

/**
 * Re-render this component when the mute changes, wherever it was changed
 * from. `useSyncExternalStore` rather than an effect + state: the store is a
 * module-level boolean read during render, which is precisely what it is for,
 * and it gets the server snapshot right for the prerender in `scripts/`.
 */
export function useSoundEnabled(): boolean {
  return useSyncExternalStore(subscribe, isEnabled, () => true);
}

/**
 * A cue-player bound to a real interaction.
 *
 * Everything this returns counts as a gesture, because the call sites are all
 * event handlers. Fire cues that are NOT a response to a press — a phase that
 * changed because somebody else acted — through `play(cue)` directly, which
 * plays only if a gesture has already opened the audio context.
 */
export function useCue(): (cue: Cue) => void {
  return useCallback((cue: Cue) => play(cue, true), []);
}

export function SoundToggle({ className = "vd-iconbtn" }: { className?: string }) {
  const on = useSoundEnabled();
  return (
    <button
      type="button"
      className={className}
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Turn game sounds off" : "Turn game sounds on"}
      title={on ? "Sounds on" : "Sounds off"}
    >
      {on ? <Volume2 size={16} /> : <VolumeX size={16} />}
    </button>
  );
}
