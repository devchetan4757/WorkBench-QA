import { useState } from "react";

export default function Notecard() {
  const [notes, setNotes] = useState(() => localStorage.getItem("qa-notes") || "");
  const [isOpen, setIsOpen] = useState(false);

  function handleChange(e) {
    setNotes(e.target.value);
    localStorage.setItem("qa-notes", e.target.value);
  }

  return (
    <>
      {/* ✅ Inline button — sits wherever placed in JSX */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: isOpen ? "rgba(251,146,60,0.2)" : "rgba(255,255,255,0.06)",
          border: isOpen ? "1px solid rgba(251,146,60,0.4)" : "1px solid rgba(255,255,255,0.1)",
          color: "#fb923c",
          fontSize: 16,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
        title="Notes"
      >
        📝
      </button>

      {/* ✅ Floating panel — fixed to viewport, opens below header */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            top: 70,
            left: 220,
            zIndex: 200,
            width: 340,
            background: "#18181b",
            border: "1px solid rgba(251,146,60,0.3)",
            borderRadius: 16,
            boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            fontFamily: "'JetBrains Mono','Fira Code',monospace",
          }}
        >
          {/* Header */}
          <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fb923c", letterSpacing: 1 }}>NOTES</span>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setNotes(""); localStorage.removeItem("qa-notes"); }}
                style={{ fontSize: 10, color: "#71717a", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
              >
                Clear
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{ fontSize: 14, color: "#71717a", background: "none", border: "none", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Textarea */}
          <textarea
            value={notes}
            onChange={handleChange}
            placeholder={"Take notes here...\n\nExamples:\n• password length = 20\n• char 1 = 'a'\n• 500 = true, 200 = false"}
            style={{
              width: "100%",
              height: 320,
              padding: 14,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#d4d4d8",
              fontSize: 12,
              fontFamily: "inherit",
              resize: "none",
              lineHeight: 1.7,
              boxSizing: "border-box",
            }}
          />

          {/* Footer */}
          <div style={{ padding: "6px 16px", borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 10, color: "#3f3f46" }}>
            {notes.length} chars · {notes.split("\n").filter(Boolean).length} lines · auto-saved
          </div>
        </div>
      )}
    </>
  );
}
