import { useState } from "react";
import { color, font } from "./theme/theme";
import { Segmented, Caret } from "./components/ui";
import { BACKEND } from "./features/workbench/constants";
import Workbench from "./features/workbench/Workbench";
import Recon from "./features/recon/Recon";

export default function App() {
  const [appMode, setAppMode] = useState("workbench");

  return (
    <div style={{ fontFamily: font.body, minHeight: "100vh", background: color.ink, color: color.text, position: "relative" }}>
      <div className="scanlines" />
      <div className="crt-vignette" />

      {/* ── HEADER — always visible ─────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        borderBottom: `2px solid ${color.line}`,
        background: "rgba(10,10,10,0.92)",
        padding: "10px 14px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{
              margin: 0, fontFamily: font.display, fontSize: 16, fontWeight: 700,
              letterSpacing: 1.5, color: color.text, display: "flex", alignItems: "center",
              textTransform: "uppercase", animation: "flicker 7s infinite",
            }}>
              QA_WORKBENCH<Caret c={appMode === "recon" ? color.red : color.amber} />
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 9.5, color: color.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              backend &gt; <span style={{ color: appMode === "recon" ? color.red : color.amber }}>{BACKEND}</span>
            </p>
          </div>
          <Segmented
            size="sm"
            options={[{ value: "workbench", label: "WORK" }, { value: "recon", label: "RECON" }]}
            value={appMode}
            onChange={setAppMode}
            accent={appMode === "recon" ? color.red : color.amber}
          />
        </div>
      </header>

      {appMode === "recon" ? <Recon /> : <Workbench />}
    </div>
  );
}
