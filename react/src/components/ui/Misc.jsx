// Misc.jsx — small atoms shared across features.
import { color, font } from "../../theme/theme";

// ── Status LED — a square pixel indicator, not a soft modern dot ────
export function Dot({ c, size = 8 }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      background: c, boxShadow: `0 0 0 2px #0a0a0a, 0 0 6px ${c}`, flexShrink: 0,
    }} />
  );
}

// ── Eyebrow / section label ──────────────────────────────────────
export function Eyebrow({ children, accent = color.dim, style }) {
  return (
    <div style={{
      fontFamily: font.display, fontSize: 9.5, fontWeight: 700, color: accent,
      letterSpacing: 2, marginBottom: 12, textTransform: "uppercase", ...style,
    }}>
      {children}
    </div>
  );
}

// ── Blinking block caret, the one recurring flourish ─────────────
export function Caret({ c = color.amber }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 9,
        height: 17,
        background: c,
        marginLeft: 4,
        animation: "blink 1.05s steps(1) infinite",
        verticalAlign: "-3px",
      }}
    />
  );
}
