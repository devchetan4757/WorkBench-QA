import { color, statusColor } from "../../../theme/theme";
import { Panel, Segmented } from "../../../components/ui";

export default function InspectorPane({ rc, active }) {
  const { selectedResult: sel, inspectorTab, setInspectorTab } = rc;

  return (
    <div className={`pane ${active ? "is-active" : ""}`}>
      <Panel framed accent={color.red} style={{ overflowY: "auto", maxHeight: "calc(100vh - 220px)" }}>
        {!sel ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: color.faint, fontSize: 13, minHeight: 200 }}>
            Click a result to inspect
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 14, alignItems: "baseline", marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: statusColor(sel.status) }}>{sel.status}</span>
              <span style={{ fontSize: 11, color: color.dim }}>{sel.time} ms</span>
              <span style={{ fontSize: 11, color: color.dim }}>{sel.size} B</span>
            </div>

            <div style={{ fontSize: 10, color: color.faint, wordBreak: "break-all", marginBottom: 14, lineHeight: 1.6 }}>
              {sel.finalUrl}
            </div>

            <Segmented size="sm" accent={color.red} options={["body", "headers"]} value={inspectorTab} onChange={setInspectorTab} />

            {inspectorTab === "body" && (
              <pre style={{ margin: "10px 0 0", fontSize: 11, color: color.text, whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: 1.6, maxHeight: "calc(100vh - 440px)", overflowY: "auto", background: "#000", padding: 12, borderRadius: 0, border: `1px solid ${color.line}` }}>
                {sel.responseBody || "(empty body)"}
              </pre>
            )}

            {inspectorTab === "headers" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 10, maxHeight: "calc(100vh - 440px)", overflowY: "auto" }}>
                {Object.entries(sel.responseHeaders).length === 0 ? (
                  <span style={{ fontSize: 11, color: color.faint }}>No headers</span>
                ) : (
                  Object.entries(sel.responseHeaders).map(([k, v]) => (
                    <div key={k} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, fontSize: 11, lineHeight: 1.5 }}>
                      <span style={{ color: color.red, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k}</span>
                      <span style={{ color: color.text, wordBreak: "break-all" }}>{v}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
