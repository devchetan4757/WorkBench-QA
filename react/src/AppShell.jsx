// AppShell.jsx  –  drop this in place of your current App.jsx entry point
// or wrap your existing App export inside this shell

import { useState } from "react";
import App from "./App";          // your existing QA Workbench
import Recon from "./Recon";      // new recon component

export default function AppShell() {
  const [mode, setMode] = useState("workbench"); // "workbench" | "recon"

  return (
    <>
      {/* ── MODE SWITCHER (always visible) ─────────────────────── */}
      <div style={{
        position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
        zIndex: 1000,
        display: "flex",
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 50,
        padding: 4,
        gap: 2,
        boxShadow: "0 4px 40px rgba(0,0,0,0.6)",
      }}>
        {[
          { key: "workbench", label: "⚡ QA Workbench", active: "#fb923c" },
          { key: "recon",     label: "🔍 Recon",        active: "#a78bfa" },
        ].map(({ key, label, active }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            style={{
              padding: "8px 20px",
              borderRadius: 50,
              border: "none",
              fontFamily: "'JetBrains Mono','Fira Code',monospace",
              fontSize: 12,
              fontWeight: mode === key ? 700 : 400,
              cursor: "pointer",
              transition: "all 0.15s",
              background: mode === key ? active : "transparent",
              color: mode === key ? "#000" : "#52525b",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── ACTIVE VIEW ────────────────────────────────────────── */}
      {mode === "workbench" ? <App /> : <Recon />}
    </>
  );
}
