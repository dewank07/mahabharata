/* ============================================================================
   One CSS media query, readable from React.

   Deliberately not a dependency, and deliberately used almost nowhere: layout
   belongs in stylesheets, and every other responsive decision in this app is a
   media query in `seal.css`. What CSS genuinely cannot express is the INITIAL
   STATE of a React component — whether the lobby's setup sections start open
   or closed — because `open` is state, not style.

   `useSyncExternalStore` rather than `useState` + an effect: it subscribes to
   `matchMedia` directly, so there is no first paint at the wrong breakpoint and
   nothing to clean up by hand. The third argument answers for environments
   with no `window`; nothing here is server-rendered today (`prerender.mjs` is
   string templating, not React), but a hook that throws in Node is a trap for
   whoever adds SSR later.
   ========================================================================== */

import { useCallback, useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  const get = useCallback(
    () =>
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia(query).matches
        : false,
    [query],
  );

  return useSyncExternalStore(subscribe, get, () => false);
}

/**
 * The one breakpoint any component is allowed to ask about. Kept as a named
 * constant so it cannot drift from the stylesheet: `seal.css` collapses the
 * lobby's setup at the same width.
 */
export const ROOMY = "(min-width: 900px)";
