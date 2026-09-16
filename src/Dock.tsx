/* ============================================================================
   The dock, and what its buttons open.

   Lives here rather than in `LandingPage` because the gate at /play wants the
   same one: somebody arriving on an invite link never sees the front page, so
   that screen is their front door and needs the same way out of it.

   It owns its own state and asks for its own viewer — a second `billing.viewer`
   subscription is free, the client dedupes identical queries — so a caller
   renders `<Dock />` and nothing else.
   ========================================================================== */

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { BookOpen, KeyRound, Loader2, Shield, Sparkles, X } from "lucide-react";
import { api } from "../convex/_generated/api";
import { SignInCard } from "./SignIn";

/* Whole pages hang off the dock, and the two screens it appears on are the two
   where first paint is the product. None of them is on the path to hosting or
   joining a game, so none is in the entry chunk: the import fires when a sheet
   opens, behind the one Suspense the panel already has. (`SignInCard` stays
   eager — it is a form, not a page.) */
const RulesPage = lazy(() => import("./RulesPage"));
const UpgradePage = lazy(() => import("./UpgradePage"));

type SheetId = "rules" | "upgrade" | "signin";

const TITLE: Record<SheetId, string> = {
  rules: "How to play",
  upgrade: "What paid adds",
  signin: "Sign in",
};

export function Dock() {
  const viewer = useQuery(api.billing.viewer, {});
  const signedIn = viewer?.signedIn === true;
  const [sheet, setSheet] = useState<SheetId | null>(null);

  /* Sign-in is pointless once you are signed in, and Admin exists for two
     people — the dock is three slots wide either way. */
  const items: Array<{ id: SheetId; label: string; icon: typeof BookOpen }> = [
    { id: "rules", label: "How to play", icon: BookOpen },
    { id: "upgrade", label: "What paid adds", icon: Sparkles },
    ...(signedIn
      ? []
      : [{ id: "signin" as const, label: "Sign in", icon: KeyRound }]),
  ];

  return (
    <>
      <nav
        className="lp-dock"
        aria-label="More about Decevia"
        /* The lens under the hovered item slides between equal-width slots, so
           it has to know how many there are — and that changes with the
           sign-in slot. One number, and the CSS does the arithmetic. */
        style={{ "--n": items.length + (viewer?.isAdmin ? 1 : 0) } as React.CSSProperties}
      >
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className="lp-dock__btn"
            onClick={() => setSheet(id)}
          >
            <Icon size={19} aria-hidden />
            {/* Real text, not a `title`: it is what a screen reader announces,
                what the tooltip shows and what a phone reads. */}
            <span className="lp-dock__label">{label}</span>
          </button>
        ))}
        {/* The one thing here that is a place rather than a panel. */}
        {viewer?.isAdmin && (
          <a className="lp-dock__btn" href="/admin">
            <Shield size={19} aria-hidden />
            <span className="lp-dock__label">Admin</span>
          </a>
        )}
      </nav>

      {sheet && (
        <Sheet title={TITLE[sheet]} onClose={() => setSheet(null)}>
          <Suspense
            fallback={
              <p className="vd-loading" role="status">
                <Loader2 size={24} className="vd-spin" color="var(--vd-brass)" />
                <span>Loading {TITLE[sheet].toLowerCase()}…</span>
              </p>
            }
          >
            {sheet === "rules" && <RulesPage />}
            {sheet === "upgrade" && <UpgradePage />}
            {sheet === "signin" && <SignInCard onDone={() => setSheet(null)} />}
          </Suspense>
        </Sheet>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ sheet -- */

/**
 * A page, opened over the page.
 *
 * The bodies are the real route components — `RulesPage`, `UpgradePage`, the
 * sign-in card — mounted unchanged. Nothing is duplicated and nothing can
 * drift: /rules and the How to play sheet are the same file, so a rule that
 * changes changes in both.
 *
 * What a dialog owes the keyboard, and all it owes:
 *
 *   - Escape closes it. Every one of these is something you read and leave;
 *     there is no forced decision here, which is exactly the case `Plate` in
 *     `TableParts` deliberately refuses Escape for.
 *   - Focus goes in on open and comes back to whatever opened it on close.
 *     Without the return trip a keyboard visitor lands at the top of the
 *     document each time they close a sheet.
 *   - Tab cycles inside. These bodies are long and full of links; leaving the
 *     trap open would walk someone silently onto the page behind.
 *   - The page behind does not scroll. A long rules sheet over a scrolling
 *     board is two scrollbars fighting for the same wheel.
 */
function Sheet({
  title, onClose, children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const el = panel.current;
    el?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const items = Array.from(
        el.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])',
        ),
      );
      if (items.length === 0) {
        e.preventDefault();
        el.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      // Open hands focus to the panel itself, which is neither end of the
      // ring — without this branch the first Shift+Tab escapes to the page.
      if (document.activeElement === el) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = scroll;
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="lp-sheet" onPointerDown={(e) => {
      // Only a press that both starts and ends on the scrim closes it, which
      // is what `onPointerDown` on the scrim itself gives us — a drag that
      // began inside the panel never reaches this handler.
      if (e.target === e.currentTarget) onClose();
    }}>
      <div
        ref={panel}
        tabIndex={-1}
        className="lp-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button
          type="button"
          className="lp-sheet__close"
          onClick={onClose}
          aria-label={`Close ${title}`}
        >
          <X size={18} />
        </button>
        <div className="lp-sheet__body">{children}</div>
      </div>
    </div>
  );
}
