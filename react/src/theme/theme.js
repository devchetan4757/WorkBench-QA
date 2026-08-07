// theme.js — single source of truth for the "8-BIT ALERT CONSOLE" design system.
//
// Direction: retro arcade / pixel-terminal, not a modern SaaS panel.
// True pixel-black background, hard 2-4px borders, ZERO border-radius,
// stepped/pixelated shadows (no blur, ever), a genuine pixel display
// face (Press Start 2P) used sparingly for chrome, a chunky pixel-terminal
// face (VT323) for everyday UI text, and a real monospace (JetBrains Mono)
// reserved for anything you actually type or read closely (request/response
// data) so the retro look never costs you legibility where it matters.
//
// THREE accent tracks, tied to what each mode DOES rather than decoration:
//   RED    — workbench / attack console (sending, mutating, firing requests)
//   PURPLE — recon / scan console (enumerating, alarms, "something was found")
//   CYAN   — utility tools (Notes, CSRF PoC, Match & Replace) — deliberately
//            a different signal so these read as "system tools riding on
//            top of the console" rather than part of the request-building
//            flow itself. Same pixel-terminal bones, different accent.
//
// NOTE ON KEY NAMES: `color.amber` and `color.red` are kept as the existing
// export names so every consuming component keeps working untouched — only
// the hex values changed. `color.amber` now IS the red workbench accent,
// `color.red` now IS the purple recon accent. True error/danger red lives
// separately as `color.danger` so alerts stay red even on the purple recon
// pages. See the bottom of this file for a plain-English map if that's
// confusing at a glance.

export const font = {
  // Chrome only: headers, button labels, badges, section titles.
  // Genuine 8-bit pixel font — keep sizes small (9-12px) and let padding do
  // the scaling, this face gets illegible/oversized fast at larger sizes.
  display: "'Press Start 2P', ui-monospace, 'SFMono-Regular', monospace",

  // Everyday UI text: hints, paragraphs, list rows, empty states. A chunky
  // pixel-terminal face that's actually comfortable to read at 14-18px.
  body: "'VT323', ui-monospace, 'SFMono-Regular', monospace",

  // Anything typed or closely read: inputs, textareas, raw request/response
  // data. Real monospace on purpose — pixel fonts are a bad time for hex,
  // JSON, or headers.
  mono: "'JetBrains Mono', 'Fira Code', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
};

// kept for any call-site still importing `mono` directly
export const mono = font.mono;

export const color = {
  ink: "#0a0a0a",        // page background — true pixel black
  panel: "#141414",      // panel background
  raised: "#1e1e1e",      // input / raised element background
  line: "#333333",        // hairline borders (dim)
  lineBright: "#666666",

  text: "#f5f5f5",        // pixel white
  dim: "#adadad",
  faint: "#5c5c5c",

  white: "#ffffff",       // pure pixel white — used for the hard bevel edge

  amber: "#ff2d40",       // workbench signature accent — 8-bit RED (kept key name for compat)
  amberDim: "#3a0a10",
  red: "#b03bff",         // recon signature accent — 8-bit PURPLE (kept key name for compat)
  redDim: "#2a0f42",

  tool: "#00e5ff",        // utility-tools accent — 8-bit CYAN (Notes, CSRF PoC, Match & Replace)
  toolDim: "#062b30",

  danger: "#ff2d40",      // true error/alarm red — always red, regardless of page accent
  dangerDim: "#3a0a10",

  green: "#3dff7a",       // 2xx / success — used only functionally, never as a base
  blue: "#4fb2ff",        // 3xx / redirects
  yellow: "#ffe066",      // timeouts / warnings

  shadow: "#000000",
};

export function statusColor(s) {
  if (!s || s === "ERR") return color.danger;
  if (s === "TIMEOUT") return color.yellow;
  if (s >= 200 && s < 300) return color.green;
  if (s >= 300 && s < 400) return color.blue;
  if (s === 401 || s === 403) return color.amber;
  if (s >= 500) return color.danger;
  return color.dim;
}

// Shared primitive styles (plain objects so inline-style call sites stay simple)
export const panelStyle = {
  background: color.panel,
  border: `2px solid ${color.line}`,
  borderRadius: 0,
  padding: 16,
};

export const inputStyle = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 0,
  border: `2px solid ${color.line}`,
  background: color.raised,
  color: color.text,
  fontFamily: font.mono,
  fontSize: 13,
  boxSizing: "border-box",
  outline: "none",
};

// Hard, stepped "pixel" shadow — deliberately blockish, never blurred.
// Doubles as the retro "keycap" depth cue for buttons/panels.
export function hardShadow(px = 4) {
  return `${px}px ${px}px 0 ${color.shadow}`;
}

// Two-tone pixel bevel: a bright inner edge + hard black drop shadow,
// the signature "8-bit dialog box" look used on framed panels.
export function pixelBevel(accent = color.amber, px = 4) {
  return `inset 0 0 0 2px ${color.ink}, inset 0 0 0 4px ${accent}, ${px}px ${px}px 0 ${color.shadow}`;
}
