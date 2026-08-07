import { useState } from "react";
import { color, statusColor } from "../../../theme/theme";
import { Panel, Button, Eyebrow, Dot } from "../../../components/ui";
import Notecard from "../../../components/common/Notecard";
import CsrfPoc from "../../../components/common/CsrfPoc";
import MatchReplace from "../../../components/common/MatchReplace";
import { SLOW_MS } from "../constants";
import BackoffBanner from "./BackoffBanner";

export default function HistoryPane({ wb, active }) {
  const {
    url, method, payloads, buildRequest, history, backoffNotice, isSending, stopSending,
    selectedResponse, setSelectedResponse, setInspectorTab,
    matchReplaceRules, addMatchReplaceRule, updateMatchReplaceRule, removeMatchReplaceRule, toggleMatchReplaceRule,
  } = wb;

  const sel = selectedResponse;

  // Only one utility tool expanded at a time — each stays a single slim
  // row when closed, only the one you tapped grows to fit its content.
  const [openTool, setOpenTool] = useState(null); // "notes" | "csrf" | "matchReplace" | null
  const toggle = (id) => setOpenTool((prev) => (prev === id ? null : id));

  return (
    <div className={`pane ${active ? "is-active" : ""}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Utility tools — inline accordions, distinct cyan "system" theme,
          expand in place instead of floating over the page. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Notecard open={openTool === "notes"} onToggle={() => toggle("notes")} />
        <CsrfPoc
          url={url} method={method} payloads={payloads} buildRequest={buildRequest}
          open={openTool === "csrf"} onToggle={() => toggle("csrf")}
        />
        <MatchReplace
          rules={matchReplaceRules}
          addRule={addMatchReplaceRule}
          updateRule={updateMatchReplaceRule}
          removeRule={removeMatchReplaceRule}
          toggleRule={toggleMatchReplaceRule}
          open={openTool === "matchReplace"} onToggle={() => toggle("matchReplace")}
        />
      </div>
      <Panel framed accent={color.amber} style={{ overflowY: "auto", maxHeight: "calc(100vh - 220px)", padding: 14 }}>
        <Eyebrow>HISTORY ({history.length})</Eyebrow>
        {backoffNotice && <BackoffBanner notice={backoffNotice} />}
        {isSending && (
          <Button variant="danger" onClick={stopSending} style={{ width: "100%", marginBottom: 10 }}>
            ■ STOP
          </Button>
        )}
        {history.length === 0 && (
          <div style={{ color: color.faint, fontSize: 12, textAlign: "center", marginTop: 50 }}>No requests yet</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {history.map((item) => (
            <button
              key={item.id}
              onClick={() => { setSelectedResponse(item); setInspectorTab("body"); }}
              style={{
                width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 0,
                background: sel?.id === item.id ? `${color.amber}1a` : item.time > SLOW_MS ? color.amberDim : "rgba(255,255,255,0.02)",
                border: sel?.id === item.id ? `2px solid ${color.amber}` : item.time > SLOW_MS ? `1px solid ${color.amber}` : `1px solid ${color.line}`,
                cursor: "pointer", fontFamily: "inherit", color: color.text, transition: "all 0.1s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <Dot c={statusColor(item.status)} />
                  <span style={{ fontSize: 11, color: color.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
                    {item.payload || "(empty)"}
                  </span>
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: statusColor(item.status), flexShrink: 0 }}>
                  {item.status}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, fontSize: 9, letterSpacing: 1 }}>
                {item.race && <span style={{ color: color.blue }}>RACE</span>}
                {item.retriesExhausted && (
                  <span style={{ color: color.danger }} title={`Gave up after ${item.retryAttempts} retries — still 429`}>MAX RETRIES</span>
                )}
                {!item.retriesExhausted && item.retryAttempts > 0 && (
                  <span style={{ color: color.yellow }} title={`Succeeded after ${item.retryAttempts} 429 retr${item.retryAttempts === 1 ? "y" : "ies"}`}>
                    RETRIED ×{item.retryAttempts}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, color: item.time > SLOW_MS ? color.yellow : color.faint, marginTop: 2 }}>
                {item.time}ms · {item.size}b
              </div>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
