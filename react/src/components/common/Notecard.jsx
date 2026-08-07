import { useState } from "react";
import { color } from "../../theme/theme";
import ToolPanel from "../ui/ToolPanel";

// Notecard.jsx — inline utility panel now (see ToolPanel.jsx). Still
// auto-saved to localStorage, still the same textarea — just expands in
// place instead of floating as a bottom-sheet/modal.
export default function Notecard({ open, onToggle }) {
  const [notes, setNotes] = useState(() => localStorage.getItem("qa-notes") || "");

  function handleChange(e) {
    setNotes(e.target.value);
    localStorage.setItem("qa-notes", e.target.value);
  }

  return (
    <ToolPanel icon="▤" label="Notes" badge={notes.length > 0 ? notes.length : null} open={open} onToggle={onToggle}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
        <button
          onClick={() => { setNotes(""); localStorage.removeItem("qa-notes"); }}
          style={{ fontSize: 10, color: color.dim, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", letterSpacing: 0.6 }}
        >
          clear
        </button>
      </div>

      <textarea
        value={notes}
        onChange={handleChange}
        placeholder={"Take notes here...\n\nExamples:\n• password length = 20\n• char 1 = 'a'\n• 500 = true, 200 = false"}
        style={{
          width: "100%",
          height: 160,
          padding: 10,
          background: color.raised ?? "#1e1e1e",
          border: `2px solid ${color.toolDim}`,
          outline: "none",
          color: color.text,
          fontSize: 12,
          fontFamily: "inherit",
          resize: "vertical",
          lineHeight: 1.7,
          boxSizing: "border-box",
        }}
      />

      <div style={{ marginTop: 6, fontSize: 10, color: color.faint }}>
        {notes.length} chars · {notes.split("\n").filter(Boolean).length} lines · auto-saved
      </div>
    </ToolPanel>
  );
}
