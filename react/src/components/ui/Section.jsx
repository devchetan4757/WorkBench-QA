// Section.jsx — accordion. Header always renders; body only mounts when
// open, so the panel stays short and only the option you actually picked
// is ever showing — everything else waits behind the toggle.
import { useState } from "react";
import { color, font } from "../../theme/theme";

export default function Section({ title, badge, defaultOpen = false, accent = color.amber, children, right }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: `2px solid ${color.line}` }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 4px",
          minHeight: 48,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: font.display,
          color: color.text,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>
          <span style={{ color: accent, fontSize: 13, display: "inline-block", width: 10 }}>{open ? "▾" : "▸"}</span>
          {title}
          {badge != null && badge !== "" && (
            <span style={{ fontFamily: font.body, fontSize: 13, color: accent, border: `2px solid ${accent}`, borderRadius: 0, padding: "1px 7px" }}>
              {badge}
            </span>
          )}
        </span>
        {right}
      </button>
      {open && <div style={{ paddingBottom: 16 }}>{children}</div>}
    </div>
  );
}
