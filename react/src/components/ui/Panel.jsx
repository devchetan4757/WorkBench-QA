// Panel.jsx — base surface. `framed` adds the signature pixel corner-bracket
// HUD motif; used on the panels that matter most so it stays a signature,
// not wallpaper.
import { color } from "../../theme/theme";

export default function Panel({ children, style, framed = false, accent = color.amber, className = "", ...rest }) {
  return (
    <div
      className={framed ? `bracket-frame ${className}` : className}
      style={{
        background: color.panel,
        border: `2px solid ${color.line}`,
        borderRadius: 0,
        padding: 16,
        "--bf-color": accent,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
