import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App";
import RulesPage from "./RulesPage";
import AdminPage from "./AdminPage";
import UpgradePage from "./UpgradePage";
import "./styles.css";
// After styles.css so the Council Seal tokens win on gameplay screens.
import "./seal.css";

const url = import.meta.env.VITE_CONVEX_URL as string;
if (!url) {
  document.body.innerHTML =
    '<pre style="color:#c0504d;font-family:monospace;padding:24px">' +
    "VITE_CONVEX_URL is not set.\n\nRun `npx convex dev` once to create a deployment " +
    "(it writes .env.local), then `npm run dev`.</pre>";
  throw new Error("VITE_CONVEX_URL missing");
}

const convex = new ConvexReactClient(url);


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

  // Everything outside a game room sits on the same board as the table, so the
  // whole app reads as one surface.
  if (route !== "game") {
    return (
      <div className="app-root">
        <div className="vd-board">
          <div className="vd-content">
            {route === "rules" && <RulesPage />}
            {route === "admin" && <AdminPage />}
            {route === "upgrade" && <UpgradePage />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <App />
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
