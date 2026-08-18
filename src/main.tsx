import { StrictMode, useEffect, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import RulesPage from "./RulesPage";
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

function Router() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const onRules = hash.startsWith("#/rules");

  return (
    <div
      className="app-root"
      style={
        onRules
          ? ({
              "--theme-ink": "#051424",
              "--theme-gold": "#f2ca50",
              "--theme-parch": "#d4e4fa",
            } as CSSProperties)
          : undefined
      }
    >
      <RoyalVoid />
      {onRules ? (
        <RulesPage />
      ) : (
        <ConvexProvider client={convex}>
          <App />
        </ConvexProvider>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router />
  </StrictMode>,
);
