// Button.jsx — "keycap" button. Hard 2px border, zero radius, pixel-notched
// corners (clip-path), hard offset shadow that presses flat on click (see
// .keycap in index.css). Bracket style ( [ RUN ] ) is available for primary
// actions. Sizing is intentionally generous — a real tap target, not a
// compact desktop control shrunk down.
import { color, font, hardShadow } from "../../theme/theme";

const NOTCH = "polygon(5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px),0 5px)";

// variant: "solid" | "ghost" | "outline" | "danger"
// size: "md" | "sm"
export default function Button({
  children, onClick, active, variant = "ghost", accent = color.amber,
  disabled, style, type = "button", title, brackets = false, size = "md",
}) {
  const solid = variant === "solid" || active;
  const isDanger = variant === "danger";
  const dangerColor = color.danger;
  const borderColor = isDanger ? dangerColor : solid ? accent : color.line;

  const base = {
    fontFamily: font.display,
    fontSize: size === "sm" ? 9.5 : 11,
    letterSpacing: 1,
    lineHeight: 1.6,
    textTransform: "uppercase",
    padding: size === "sm" ? "10px 14px" : "13px 18px",
    borderRadius: 0,
    clipPath: NOTCH,
    cursor: disabled ? "not-allowed" : "pointer",
    border: `2px solid ${borderColor}`,
    background: isDanger ? color.dangerDim : solid ? accent : "transparent",
    color: isDanger ? dangerColor : solid ? "#0a0a0a" : color.dim,
    fontWeight: 700,
    boxShadow: disabled ? "none" : hardShadow(4),
    transition: "border-color .1s, color .1s, background .1s",
    opacity: disabled ? 0.4 : 1,
    whiteSpace: "nowrap",
    minHeight: 40,
  };

  return (
    <button
      type={type}
      className="keycap"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{ ...base, ...style }}
    >
      {brackets ? <>[&nbsp;{children}&nbsp;]</> : children}
    </button>
  );
}
