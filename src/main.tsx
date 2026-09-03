import { lazy, StrictMode, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import App from "./App";
import RulesPage from "./RulesPage";
import AdminPage from "./AdminPage";
import UpgradePage from "./UpgradePage";
import { SignInPage } from "./SignIn";
// Standalone, animation-heavy, and read once — it has no business riding
// along in the bundle every player downloads to sit at a table.
const LearnPage = lazy(() => import("./LearnPage"));
import { LandingPage } from "./LandingPage";
import { AuthProvider } from "./auth";
import {
  adoptLegacyHashRoute,
  useLinkInterception,
  useLocation,
} from "./router";
import "./styles.css";
// After styles.css so the Council Seal tokens win on gameplay screens.
import "./seal.css";
import { Loader2 } from "lucide-react";

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
  learn: {
    title: "How to play — Decevia",
    description:
      "A walkthrough you can step through: one round from start to finish, every role, the three add-ons and all nine plot cards.",
  },
  rules: {
    title: "The rules — Decevia",
    description:
      "Team sizes, who gets shown what, the three add-ons, and how games of more than ten people work.",
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
            {route === "signin" && <SignInPage />}
            {route === "learn" && (
              <Suspense
                fallback={
                  <p className='vd-loading' role='status'>
                    <Loader2 size={24} className='vd-spin' color='var(--vd-brass)' />
                    <span>Loading how to play…</span>
                  </p>
                }
              >
                <LearnPage />
              </Suspense>
            )}
            {route === "rules" && <RulesPage />}
            {route === "admin" && <AdminPage />}
            {route === "upgrade" && <UpgradePage />}
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
    : at("/learn")
      ? "learn"
      : at("/rules")
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
  </StrictMode>,
);
