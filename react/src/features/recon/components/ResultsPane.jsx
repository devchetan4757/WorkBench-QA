import { color, statusColor } from "../../../theme/theme";
import { Panel, Button, Dot } from "../../../components/ui";
import { statusBg } from "../utils/reconUtils";

const TABS = [
  { key: "all", label: "All" },
  { key: "2xx", label: "2xx" },
  { key: "3xx", label: "3xx" },
  { key: "auth", label: "401/403" },
  { key: "err", label: "Errors" },
];

export default function ResultsPane({ rc, active }) {
  const {
    filterTab, setFilterTab, countByTab, results, isRunning, progress,
    findings, selectedResult, setSelectedResult, downloadCsv,
  } = rc;

  const sel = selectedResult;

  return (
    <div className={`pane ${active ? "is-active" : ""}`} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilterTab(key)}
            style={{
              padding: "5px 11px", borderRadius: 0, fontFamily: "inherit", fontSize: 11, cursor: "pointer",
              textTransform: "uppercase", letterSpacing: 0.6,
              border: filterTab === key ? `2px solid ${color.red}` : `1px solid ${color.line}`,
              background: filterTab === key ? color.redDim : "rgba(255,255,255,0.02)",
              color: filterTab === key ? color.red : color.faint,
            }}
          >
            {label}{" "}
            {countByTab[key] > 0 && (
              <span style={{ color: filterTab === key ? color.red : color.faint }}>({countByTab[key]})</span>
            )}
          </button>
        ))}

        {results.length > 0 && (
          <Button style={{ marginLeft: "auto" }} onClick={downloadCsv}>
            ↓ CSV
          </Button>
        )}
      </div>

      <Panel framed accent={color.red} style={{ padding: 0, overflow: "hidden", flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "62px 1fr 64px 64px", padding: "8px 12px", borderBottom: `1px solid ${color.line}`, fontSize: 9, color: color.faint, letterSpacing: 1.5, textTransform: "uppercase" }}>
          <span>Status</span>
          <span>Path</span>
          <span style={{ textAlign: "right" }}>Size</span>
          <span style={{ textAlign: "right" }}>Time</span>
        </div>

        <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 320px)" }}>
          {findings.length === 0 && !isRunning && (
            <div style={{ padding: 40, textAlign: "center", color: color.faint, fontSize: 13 }}>
              {results.length === 0 ? "Run a scan to see results" : "No results match this filter"}
            </div>
          )}

          {isRunning && findings.length === 0 && (
            <div style={{ padding: 20, textAlign: "center" }}>
              <div style={{ color: color.red, fontSize: 12, marginBottom: 6 }}>Scanning… {progress.done}/{progress.total}</div>
              <div style={{ fontSize: 10, color: color.faint }}>Filtered codes are hidden</div>
            </div>
          )}

          {findings.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedResult(sel?.id === item.id ? null : item)}
              style={{
                display: "grid", gridTemplateColumns: "62px 1fr 64px 64px", padding: "9px 12px",
                borderBottom: `1px solid ${color.line}`, cursor: "pointer", alignItems: "center",
                background: sel?.id === item.id ? `${color.red}1a` : statusBg(item.status),
                transition: "background 0.1s",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 700, fontSize: 12, color: statusColor(item.status) }}>
                <Dot c={statusColor(item.status)} size={6} />{item.status}
              </span>
              <span style={{ fontSize: 12, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>/{item.path}</span>
              <span style={{ fontSize: 11, color: color.faint, textAlign: "right" }}>
                {item.size > 0 ? (item.size > 1024 ? `${(item.size / 1024).toFixed(1)}k` : `${item.size}B`) : "—"}
              </span>
              <span style={{ fontSize: 11, color: item.time > 2000 ? color.yellow : color.faint, textAlign: "right" }}>{item.time}ms</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
