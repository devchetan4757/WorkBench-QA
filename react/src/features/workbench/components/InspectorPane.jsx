import { color, statusColor } from "../../../theme/theme";
import { Panel, Segmented } from "../../../components/ui";

export default function InspectorPane({ wb, active }) {
  const { selectedResponse: sel, inspectorTab, setInspectorTab } = wb;

  return (
    <div className={`pane ${active ? "is-active" : ""}`}>
      <Panel framed accent={color.amber} style={{ overflowY: "auto", maxHeight: "calc(100vh - 220px)" }}>
        {!sel ? (
          <div style={{ color: color.faint, fontSize: 13, textAlign: "center", marginTop: 100 }}>
            Select a response to inspect
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: statusColor(sel.status) }}>{sel.status}</span>
              <span style={{ fontSize: 11, color: color.dim }}>{sel.time}ms · {sel.size}b</span>
            </div>
            <Segmented
              size="sm"
              options={["body", "headers", "request"]}
              value={inspectorTab}
              onChange={setInspectorTab}
            />
            <pre style={{ background: "#000", borderRadius: 0, padding: 14, fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: 1.6, color: color.text, border: `1px solid ${color.line}`, marginTop: 10 }}>
              {inspectorTab === "body" && sel.responseBody}
              {inspectorTab === "headers" && JSON.stringify(sel.responseHeaders, null, 2)}
              {inspectorTab === "request" && sel.requestPreview}
            </pre>
          </>
        )}
      </Panel>
    </div>
  );
}
