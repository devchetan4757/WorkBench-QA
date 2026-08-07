import { color, font, inputStyle } from "../../theme/theme";
import { Button, Field } from "../ui";
import ToolPanel from "../ui/ToolPanel";

const SCOPES = [
  { value: "url", label: "URL" },
  { value: "headers", label: "Headers" },
  { value: "body", label: "Body" },
];

// MatchReplace.jsx — inline utility panel now (see ToolPanel.jsx). Same
// rule engine as before (applyMatchReplace / useMatchReplace), just
// expands in place instead of floating as a modal.
export default function MatchReplace({ rules, addRule, updateRule, removeRule, toggleRule, open, onToggle }) {
  const activeCount = rules.filter((r) => r.enabled && r.find).length;

  return (
    <ToolPanel icon="⇌" label="Match & Replace" badge={activeCount || null} open={open} onToggle={onToggle}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 10, color: color.dim, lineHeight: 1.5 }}>
          Rules apply automatically to every request you send — Workbench and CSRF PoC alike. Runs top to bottom.
        </div>

        {rules.length === 0 && (
          <div style={{ fontSize: 12, color: color.faint, textAlign: "center", padding: "16px 0" }}>
            No rules yet
          </div>
        )}

        {rules.map((rule) => (
          <RuleRow key={rule.id} rule={rule} updateRule={updateRule} removeRule={removeRule} toggleRule={toggleRule} />
        ))}

        <Button onClick={() => addRule()} variant="solid" accent={color.tool} style={{ width: "100%" }}>
          + ADD RULE
        </Button>
      </div>
    </ToolPanel>
  );
}

function RuleRow({ rule, updateRule, removeRule, toggleRule }) {
  return (
    <div style={{
      border: `2px solid ${color.toolDim}`,
      padding: 10,
      background: rule.enabled ? "rgba(0,229,255,0.03)" : "transparent",
      opacity: rule.enabled ? 1 : 0.5,
    }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
        <button
          type="button"
          onClick={() => toggleRule(rule.id)}
          title={rule.enabled ? "Disable rule" : "Enable rule"}
          style={{
            width: 18, height: 18, flexShrink: 0, cursor: "pointer",
            border: `2px solid ${rule.enabled ? color.tool : color.line}`,
            background: rule.enabled ? color.tool : "transparent",
          }}
        />
        <select
          style={{ ...inputStyle, padding: "6px 8px", fontSize: 11, width: 100, flexShrink: 0 }}
          value={rule.scope}
          onChange={(e) => updateRule(rule.id, { scope: e.target.value })}
        >
          {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: color.dim, whiteSpace: "nowrap" }}>
          <input
            type="checkbox"
            checked={!!rule.isRegex}
            onChange={(e) => updateRule(rule.id, { isRegex: e.target.checked })}
          />
          regex
        </label>
        <button
          type="button"
          onClick={() => removeRule(rule.id)}
          title="Delete rule"
          style={{ marginLeft: "auto", fontSize: 14, color: color.danger, background: "none", border: "none", cursor: "pointer", lineHeight: 1, flexShrink: 0 }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <Field label="Find" style={{ marginBottom: 0 }}>
          <input
            style={{ ...inputStyle, fontSize: 12, padding: "8px 10px" }}
            value={rule.find}
            onChange={(e) => updateRule(rule.id, { find: e.target.value })}
            placeholder={rule.isRegex ? "X-Debug: .*" : "old-value"}
          />
        </Field>
        <Field label="Replace" style={{ marginBottom: 0 }}>
          <input
            style={{ ...inputStyle, fontSize: 12, padding: "8px 10px" }}
            value={rule.replace}
            onChange={(e) => updateRule(rule.id, { replace: e.target.value })}
            placeholder="new-value"
          />
        </Field>
      </div>
    </div>
  );
}
