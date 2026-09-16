import { lazy, StrictMode, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import App from "./App";
import AdminPage from "./AdminPage";

/* Lazy on BOTH sides or lazy on neither: `LandingPage` opens these in sheets
   with `lazy()`, and a static import here would pull them straight back into
   the entry chunk and quietly defeat it — which is exactly what the bundler
   warned about when this file imported them directly. */
const RulesPage = lazy(() => import("./RulesPage"));
const UpgradePage = lazy(() => import("./UpgradePage"));
import { SignInPage } from "./SignIn";
// Standalone, animation-heavy, and read once — it has no business riding
// along in the bundle every player downloads to sit at a table.
import { LandingPage } from "./LandingPage";
import { AuthProvider } from "./auth";
import { Loader2 } from "lucide-react";
/* `/react`, not `/next` — the dashboard's Get Started card defaults to the
   Next.js snippet and this is a Vite SPA. The component only injects
   `/_vercel/insights/script.js`; the route tracking lives in that script, not
   in this package, which is why the rewrite in `vercel.json` has to let the
   `_vercel` namespace through or nothing is ever counted. */
import { Analytics } from "@vercel/analytics/react";
import {
  adoptLegacyHashRoute,
  useLinkInterception,
  useLocation,
} from "./router";
import "./styles.css";
// The design system's own token set. Before seal.css, which aliases its
// `--vd-*` names onto these — a var() referencing a later declaration would
// resolve to nothing.
import "./tokens.css";
// After styles.css so the Verdict Table tokens win on gameplay screens.
import "./seal.css";
// After seal.css, and here rather than inside CharacterCard: a component-level
// import lands wherever the bundler happens to reach it, and the card's rules
// are meant to sit on top of the seal's.
import "./character-card.css";
// Last, and for the same reason character-card.css is late: the chamber layer
// is presentation laid ON the finished system — an illustrated ground, the
// front door's fan, the phone's role handle — and each one needs to win
// against the rule it is replacing.
import "./chamber.css";

const url = import.meta.env.VITE_CONVEX_URL as string;
if (!url) {
  document.body.innerHTML =
    '<pre style="color:#c0504d;font-family:monospace;padding:24px">' +
    "VITE_CONVEX_URL is not set.\n\nRun `npx convex dev` once to create a deployment " +
    "(it writes .env.local), then `npm run dev`.</pre>";
  throw new Error("VITE_CONVEX_URL missing");
}

const convex = new ConvexReactClient(url);

/**
 * One title tag serves every route in a single-page app, so a crawler — and a
 * bookmark, and a browser-history search — sees "Decevia" for all six. These
 * are the per-route replacements. The index.html copy stays the default and
 * the one a crawler that runs no JS will read.
 */
const PAGE_META: Record<string, { title: string; description: string }> = {
  landing: {
    title: "Decevia — Social deduction for 5 to 18 players",
    description:
      "A free hidden-roles party game for 5 to 18 people in the same room, played on your phones. Most of you are good; a few are secretly not. Five settings to play it in.",
  },
  rules: {
    title: "How to play — Decevia",
    description:
      "Watch a round play out, then look it up: how a round works, how you win, team sizes, who gets shown what, and every role.",
  },
  signin: {
    title: "Sign in — Decevia",
    description: "Sign in or create an account. You don't need one to play.",
  },
  upgrade: {
    title: "Plans — Decevia",
    description: "What a paid plan adds: the extra roles, all three add-ons and the four other settings.",
  },
  game: { title: "Your game — Decevia", description: "" },
  admin: { title: "Admin — Decevia", description: "" },
};

function useDocumentMeta(route: string) {
  useEffect(() => {
    const meta = PAGE_META[route];
    if (!meta) return;
    document.title = meta.title;
    if (!meta.description) return;
    const tag = document.querySelector('meta[name="description"]');
    if (tag) tag.setAttribute("content", meta.description);
  }, [route]);
}

// Before the first render, so `useLocation` never sees the hash form.
adoptLegacyHashRoute();

function Router() {
  const { pathname, search } = useLocation();
  useLinkInterception();

  // An invite link (…/?code=ABCD) has to reach the table even though the
  // index is now a holding page, so it counts as a request to play.
  const invited = new URLSearchParams(search).has("code");
  const route = routeFor(pathname, invited);
  useDocumentMeta(route);

  // The landing page paints its own board, so it sits outside the shared shell.
  if (route === "landing") {
    return (
      <div className='app-root'>
        <LandingPage />
      </div>
    );
  }

  // Everything outside a game room sits on the same board as the table, so the
  // whole app reads as one surface.
  if (route !== "game") {
    return (
      <div className='app-root'>
        <div className='vd-board'>
          <div className='vd-content'>
            <Suspense
              fallback={
                <p className='vd-loading' role='status'>
                  <Loader2 size={24} className='vd-spin' color='var(--vd-brass)' />
                  <span>Loading…</span>
                </p>
              }
            >
              {route === "signin" && <SignInPage />}
              {/* /learn and /rules are the same page. They were two, and the
                  second repeated most of the first; both paths are kept
                  because both are in links already handed out. */}
              {route === "rules" && <RulesPage />}
              {route === "admin" && <AdminPage />}
              {route === "upgrade" && <UpgradePage />}
            </Suspense>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='app-root'>
      <App />
    </div>
  );
}

/** Path → route name. Split out so the title effect and the render agree. */
function routeFor(pathname: string, invited: boolean) {
  const at = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`);

  return at("/signin")
    ? "signin"
    : at("/learn") || at("/rules")
      ? "rules"
      : at("/admin")
        ? "admin"
        : at("/upgrade")
          ? "upgrade"
          : at("/play") || invited
            ? "game"
            : "landing";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Auth wraps everything: the admin console and the upgrade flow both need
        a signed-in identity, and the game reads entitlement from it. */}
    <AuthProvider client={convex}>
      <Router />
    </AuthProvider>
    {/* Outside the provider on purpose: page views are not an authenticated
        concern, and a failure here must never be able to take the app down
        with it. */}
    <Analytics />
  </StrictMode>,
);
