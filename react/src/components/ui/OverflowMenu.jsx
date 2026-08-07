// OverflowMenu.jsx — the "⋮" pixel menu button. Extra / secondary options
// live here instead of sitting on the panel all the time: nothing shows
// until the trigger is tapped. Works two ways —
//   1) one-shot actions (e.g. "Clear history")
//   2) a picker for a setting you rarely change (pass `selected` on the
//      matching item and it renders as a checked radio, trigger can show
//      the current value so you're not hunting for it)
// Use this for anything that isn't the one or two things someone needs
// on every single visit to a panel — that's the stuff Burp buries behind
// a small dropdown or right-click menu instead of a permanent button row.
//
// items: [{ label, onClick, danger?, disabled?, selected?, keepOpen? }]
// keepOpen: true — for independent toggles, so flipping one option
// doesn't close the menu before you can flip the next one.
import { useEffect, useRef, useState } from "react";
import { color, font, hardShadow } from "../../theme/theme";

export default function OverflowMenu({ items, accent = color.amber, align = "right", title = "More options", trigger = "⋮" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const isIconTrigger = trigger === "⋮";

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="keycap"
        style={{
          minWidth: isIconTrigger ? 40 : undefined,
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          fontFamily: font.display,
          fontSize: isIconTrigger ? 16 : 9.5,
          letterSpacing: isIconTrigger ? 2 : 0.6,
          lineHeight: 1,
          textTransform: isIconTrigger ? "none" : "uppercase",
          padding: isIconTrigger ? 0 : "0 14px",
          cursor: "pointer",
          border: `2px solid ${open ? accent : color.line}`,
          background: open ? accent : "transparent",
          color: open ? "#0a0a0a" : color.dim,
          boxShadow: hardShadow(3),
          whiteSpace: "nowrap",
        }}
      >
        {trigger}
      </button>

      {open && (
        <div
          className="overflow-menu-panel"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            [align]: 0,
            minWidth: 190,
            background: color.panel,
            border: `2px solid ${accent}`,
            boxShadow: hardShadow(4),
            zIndex: 60,
            padding: 4,
          }}
        >
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              disabled={it.disabled}
              onClick={() => {
                if (!it.keepOpen) setOpen(false);
                it.onClick?.();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                textAlign: "left",
                padding: "12px 12px",
                minHeight: 40,
                background: it.selected ? `${accent}1a` : "transparent",
                border: "none",
                borderBottom: i < items.length - 1 ? `1px solid ${color.line}` : "none",
                fontFamily: font.body,
                fontSize: 16,
                color: it.danger ? color.danger : it.selected ? accent : color.text,
                cursor: it.disabled ? "not-allowed" : "pointer",
                opacity: it.disabled ? 0.4 : 1,
              }}
            >
              {it.selected != null && (
                <span style={{ width: 12, flexShrink: 0 }}>{it.selected ? "■" : ""}</span>
              )}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
