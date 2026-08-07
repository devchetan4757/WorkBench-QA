// Field.jsx — label + control, uppercase micro-label in the display face.
import { color, font } from "../../theme/theme";

export default function Field({ label, hint, children, style }) {
  return (
    <div style={{ marginBottom: 16, ...style }}>
      {label && (
        <div style={{
          fontFamily: font.display, fontSize: 9.5, fontWeight: 700,
          color: color.dim, marginBottom: 7, letterSpacing: 1,
          textTransform: "uppercase",
        }}>
          {label}
        </div>
      )}
      {children}
      {hint && <div style={{ fontFamily: font.body, fontSize: 14, color: color.faint, marginTop: 5 }}>{hint}</div>}
    </div>
  );
}
