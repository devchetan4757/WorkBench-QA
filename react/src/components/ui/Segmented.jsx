// Segmented.jsx — tab-style segmented control, hard borders, no radius,
// bigger tap targets than a dense desktop control.
import { color, font } from "../../theme/theme";

export default function Segmented({ options, value, onChange, accent = color.amber, size = "md" }) {
  const pad = size === "sm" ? "9px 12px" : "12px 16px";
  const fs = size === "sm" ? 9.5 : 10.5;
  return (
    <div style={{ display: "flex", border: `2px solid ${color.line}`, borderRadius: 0, overflow: "hidden" }}>
      {options.map((opt, i) => {
        const val = typeof opt === "string" ? opt : opt.value;
        const label = typeof opt === "string" ? opt : opt.label;
        const isActive = value === val;
        return (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            style={{
              flex: 1,
              padding: pad,
              minHeight: 40,
              border: "none",
              borderRight: i < options.length - 1 ? `2px solid ${color.line}` : "none",
              fontFamily: font.display,
              fontSize: fs,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              cursor: "pointer",
              background: isActive ? accent : "transparent",
              color: isActive ? "#0a0a0a" : color.dim,
              fontWeight: isActive ? 700 : 500,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
