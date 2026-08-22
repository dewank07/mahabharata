import { StrictMode, useEffect, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App";
import RulesPage from "./RulesPage";
import AdminPage from "./AdminPage";
import UpgradePage from "./UpgradePage";
import "./styles.css";

const url = import.meta.env.VITE_CONVEX_URL as string;
if (!url) {
  document.body.innerHTML =
    '<pre style="color:#c0504d;font-family:monospace;padding:24px">' +
    "VITE_CONVEX_URL is not set.\n\nRun `npx convex dev` once to create a deployment " +
    "(it writes .env.local), then `npm run dev`.</pre>";
  throw new Error("VITE_CONVEX_URL missing");
}

const convex = new ConvexReactClient(url);

function RoyalVoid() {
  return (
    <div className="royal-void" aria-hidden>
      <div className="royal-void__lintel" />
      <div className="royal-void__corona" />
      <div className="royal-void__ring" />
      <span className="royal-void__mote royal-void__mote--a" />
      <span className="royal-void__mote royal-void__mote--b" />
      <span className="royal-void__mote royal-void__mote--c" />
      <span className="royal-void__mote royal-void__mote--d" />
      <div className="royal-void__vignette" />
    </div>
  );
}

/** Palette used by the pages that sit outside a game room. */
const PLAIN_THEME = {
  "--theme-ink": "#051424",
  "--theme-gold": "#f2ca50",
  "--theme-parch": "#d4e4fa",
} as CSSProperties;

function Router() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const route = hash.startsWith("#/rules")
    ? "rules"
    : hash.startsWith("#/admin")
      ? "admin"
      : hash.startsWith("#/upgrade")
        ? "upgrade"
        : "game";

  return (
    <div
      className="app-root"
      style={route === "game" ? undefined : PLAIN_THEME}
    >
      <RoyalVoid />
      {route === "rules" && <RulesPage />}
      {route === "admin" && <AdminPage />}
      {route === "upgrade" && <UpgradePage />}
      {route === "game" && <App />}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Auth wraps everything: the admin console and the upgrade flow both need
        a signed-in identity, and the game reads entitlement from it. */}
    <ConvexAuthProvider client={convex}>
      <Router />
    </ConvexAuthProvider>
  </StrictMode>,
);
