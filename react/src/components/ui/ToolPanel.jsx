// ToolPanel.jsx — shared inline accordion shell for the "extra options"
// tier (Notes, CSRF PoC, Match & Replace). Deliberately NOT a modal/overlay
// — clicking the header expands the content in place, pushing whatever's
// below it down, and collapses back to a single slim row when closed. No
// wasted space, no card floating over the page.
//
// Distinct "SYSTEM" cyan theme (color.tool) so these read as utility tools
// riding on top of the red Workbench console, not part of the request-
// building flow itself — same pixel-terminal bones (hard borders, zero
// radius, Press Start 2P chrome), different accent + a terminal-style
// ">" prompt glyph instead of the workbench's caret bracket motif.
import { color, font } from "../../theme/theme";

export default function ToolPanel({ icon, label, badge, open, onToggle, children }) {
  return (
    <div style={{
      border: `2px solid ${open ? color.tool : color.line}`,
      background: color.panel,
      fontFamily: font.body,
    }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 10px",
          minHeight: 40,
          background: open ? `${color.tool}14` : "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: font.display,
          textAlign: "left",
        }}
      >
        <span style={{ color: color.tool, fontSize: 12, width: 14, flexShrink: 0, textAlign: "center" }}>{icon}</span>
        <span style={{
          fontSize: 9.5, letterSpacing: 1.2, fontWeight: 700,
          color: open ? color.tool : color.dim, textTransform: "uppercase", flex: 1, minWidth: 0,
        }}>
          {label}
        </span>
        {badge != null && badge !== "" && badge !== 0 && (
          <span style={{
            fontFamily: font.body, fontSize: 12, color: color.tool,
            border: `2px solid ${color.tool}`, padding: "0 6px", flexShrink: 0,
          }}>
            {badge}
          </span>
        )}
        <span style={{ color: color.tool, fontSize: 11, flexShrink: 0 }}>{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div style={{
          padding: 12,
          borderTop: `1px solid ${color.toolDim}`,
          background: "rgba(0,229,255,0.02)",
        }}>
          {children}
        </div>
      )}
    </div>
  );
}
