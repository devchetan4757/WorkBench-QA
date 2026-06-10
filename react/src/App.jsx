import CsrfPoc from "./CsrfPoc";
import { useState, useMemo, useRef } from "react";
import Notecard from "./Notecard";

const BACKEND = "http://localhost:5000";

export default function App() {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [headersText, setHeadersText] = useState("User-Agent: QA-Workbench\nAccept: */*");
  const [cookie, setCookie] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("TrackingId=test{{payload}}");

  const [payloadMode, setPayloadMode] = useState("single");
  const [singlePayload, setSinglePayload] = useState("1");
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(5);
  const [charFrom, setCharFrom] = useState("a");
  const [charTo, setCharTo] = useState("z");
  const [manualList, setManualList] = useState("1\n2\n3");

  const [shouldStop, setShouldStop] = useState(false);
  const [sendMode, setSendMode] = useState("sequential");
  const [history, setHistory] = useState([]);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [inspectorTab, setInspectorTab] = useState("body");
  const stopRef = useRef(false);
  const SLOW_MS = 2000;

  // ─── Inject payload into any string ───────────────────────
  function injectPayload(template, payload) {
    return String(template).replaceAll("{{payload}}", payload);
  }

  // ─── Parse headers text → object ──────────────────────────
  function parseHeaders(text, payload = "") {
    const headers = {};
    const blocked = ["host", "content-length", "cookie", "origin"];
    text.split("\n").forEach((line) => {
      const idx = line.indexOf(":");
      if (idx > -1) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim();
        if (key && !blocked.includes(key.toLowerCase())) {
          headers[key] = injectPayload(val, payload); // ← inject into header values
        }
      }
    });
    if (cookie.trim()) {
      headers["Cookie"] = injectPayload(cookie.trim(), payload);
    }
    return headers;
  }

  // ─── Generate payloads ─────────────────────────────────────
  function generatePayloads() {
    if (payloadMode === "single") return [singlePayload];
    if (payloadMode === "numeric") {
      const arr = [];
      for (let i = Number(rangeStart); i <= Number(rangeEnd); i++) arr.push(String(i));
      return arr;
    }
    if (payloadMode === "charset") {
      const arr = [];
      const start = charFrom.charCodeAt(0);
      const end = charTo.charCodeAt(0);
      for (let i = start; i <= end; i++) arr.push(String.fromCharCode(i));
      return arr;
    }
    if (payloadMode === "manual") {
      return manualList.split("\n").map((v) => v.trim()).filter(Boolean);
    }
    return [];
  }

  const payloads = useMemo(
    () => generatePayloads(),
    [payloadMode, singlePayload, rangeStart, rangeEnd, charFrom, charTo, manualList]
  );

  function buildRequestPreview(payload, headers) {
    const body = injectPayload(bodyTemplate, payload);
    const injectedUrl = injectPayload(url, payload);
    let preview = `${method} ${injectedUrl} HTTP/1.1\n`;
    Object.entries(headers).forEach(([k, v]) => { preview += `${k}: ${v}\n`; });
    preview += "\n";
    if (method !== "GET") preview += body;
    return preview;
  }

  // ─── Build request parts for a given payload ───────────────
  function buildRequest(payload) {
    const parsedHeaders = parseHeaders(headersText, payload);
    const body = injectPayload(bodyTemplate, payload);
    const injectedUrl = injectPayload(url, payload);
    const targetUrl = method === "GET"
      ? injectedUrl + (body.trim() ? (injectedUrl.includes("?") ? "&" : "?") + body : "")
      : injectedUrl;
    return { parsedHeaders, body, targetUrl };
  }

  function statusColor(s) {
    if (s === "TIMEOUT") return "#f59e0b";
    if (s === "ERROR") return "#f87171";
    if (typeof s === "number") {
      if (s < 300) return "#34d399";
      if (s < 400) return "#60a5fa";
      if (s < 500) return "#fb923c";
      return "#f87171";
    }
    return "#a1a1aa";
  }

  // ─── SEQUENTIAL ────────────────────────────────────────────
  async function sendAll() {
    stopRef.current = false;
    setShouldStop(false);
    if (!url.trim()) { alert("Enter a target URL"); return; }
    setIsSending(true);
    setHistory([]);
    setSelectedResponse(null);

    for (const payload of payloads) {
      if (stopRef.current) break;
      const { parsedHeaders, body, targetUrl } = buildRequest(payload);
      const requestPreview = buildRequestPreview(payload, parsedHeaders);

      let result;
      try {
        const fd = new FormData();
        fd.append("url", targetUrl);
        fd.append("method", method);
        fd.append("headers", JSON.stringify(parsedHeaders));
        fd.append("body", method !== "GET" ? body : "");

        const res = await fetch(`${BACKEND}/api/request`, { method: "POST", body: fd });
        const rawText = await res.text();

        let data;
        try { data = JSON.parse(rawText); }
        catch { data = { status: res.status, body: rawText || "(empty)", headers: {}, size: rawText.length, time: 0, final_url: targetUrl }; }

        result = {
          id: Date.now() + Math.random(),
          payload, requestPreview,
          status: data.status ?? res.status,
          time: data.time ?? 0,
          finalUrl: data.final_url ?? targetUrl,
          responseHeaders: data.headers ?? {},
          responseBody: String(data.body ?? "(empty body)"),
          size: data.size ?? 0,
        };
      } catch (networkErr) {
        result = {
          id: Date.now() + Math.random(),
          payload, requestPreview,
          status: "ERROR", time: 0, finalUrl: targetUrl,
          responseHeaders: {}, size: 0,
          responseBody: `Network error: ${String(networkErr)}`,
        };
      }

      setHistory((prev) => [result, ...prev]);
      setSelectedResponse((prev) => prev ?? result);
    }

    setIsSending(false);
  }

  // ─── PARALLEL ──────────────────────────────────────────────
  async function sendParallel() {
    if (!url.trim()) { alert("Enter a target URL"); return; }
    setIsSending(true);
    setHistory([]);
    setSelectedResponse(null);

    const results = await Promise.allSettled(
      payloads.map(async (payload) => {
        const { parsedHeaders, body, targetUrl } = buildRequest(payload);

        const fd = new FormData();
        fd.append("url", targetUrl);
        fd.append("method", method);
        fd.append("headers", JSON.stringify(parsedHeaders));
        fd.append("body", method !== "GET" ? body : "");

        const res = await fetch(`${BACKEND}/api/request`, { method: "POST", body: fd });
        const data = await res.json();

        return {
          id: Date.now() + Math.random(),
          payload,
          requestPreview: buildRequestPreview(payload, parsedHeaders),
          status: data.status ?? res.status,
          time: data.time ?? 0,
          finalUrl: data.final_url ?? targetUrl,
          responseHeaders: data.headers ?? {},
          responseBody: String(data.body ?? "(empty body)"),
          size: data.size ?? 0,
          race: true,
        };
      })
    );

    const mapped = results.map((r) =>
      r.status === "fulfilled" ? r.value : {
        id: Date.now() + Math.random(),
        payload: "?", requestPreview: "", status: "ERROR",
        time: 0, finalUrl: url, responseHeaders: {},
        responseBody: String(r.reason), size: 0, race: true,
      }
    );

    setHistory(mapped);
    setSelectedResponse(mapped[0] ?? null);
    setIsSending(false);
  }

  // ─── LAST-BYTE ─────────────────────────────────────────────
  async function sendLastByte() {
    if (!url.trim()) { alert("Enter a target URL"); return; }
    setIsSending(true);
    setHistory([]);
    setSelectedResponse(null);

    const requestsList = payloads.map((payload) => {
      const { parsedHeaders, body, targetUrl } = buildRequest(payload);
      return { url: targetUrl, method, headers: parsedHeaders, body };
    });

    const res = await fetch(`${BACKEND}/api/lastbyte`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests: requestsList }),
    });

    const results = await res.json();

    const mapped = results.map((r, i) => ({
      id: Date.now() + i,
      payload: payloads[i],
      requestPreview: buildRequestPreview(payloads[i], parseHeaders(headersText, payloads[i])),
      status: r.status ?? "ERROR",
      time: r.time ?? 0,
      finalUrl: url,
      responseHeaders: r.headers ?? {},
      responseBody: String(r.body ?? ""),
      size: r.size ?? 0,
      race: true,
    }));

    setHistory(mapped);
    setSelectedResponse(mapped[0] ?? null);
    setIsSending(false);
  }

  const sel = selectedResponse;

  // ─── RENDER ────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", minHeight: "100vh", background: "linear-gradient(135deg,#09090b 0%,#18181b 60%,#111 100%)", color: "#f4f4f5" }}>

      {/* HEADER */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.75)", backdropFilter: "blur(18px)", padding: "12px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: -1, background: "linear-gradient(90deg,#fb923c,#fbbf24,#fff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            QA Workbench
          </h1>
          <p style={{ margin: 0, fontSize: 10, color: "#52525b" }}>
            backend → <span style={{ color: "#fb923c" }}>{BACKEND}</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { setHistory([]); setSelectedResponse(null); }}
            style={{ padding: "10px 18px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "none", color: "#f4f4f5", cursor: "pointer", fontFamily: "inherit" }}>
            Clear
          </button>
          <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid #27272a" }}>
            {["sequential", "parallel", "lastbyte"].map((mode) => (
              <button key={mode} onClick={() => setSendMode(mode)} style={{
                padding: "8px 14px", border: "none", fontFamily: "inherit",
                fontSize: 11, cursor: "pointer",
                background: sendMode === mode ? "#fb923c" : "rgba(255,255,255,0.04)",
                color: sendMode === mode ? "#000" : "#71717a",
                fontWeight: sendMode === mode ? 700 : 400,
              }}>
                {mode === "sequential" ? "⏩ Sequential" : mode === "parallel" ? "⚡ Parallel" : "🎯 Last-Byte"}
              </button>
            ))}
          </div>
          <button
            onClick={sendMode === "parallel" ? sendParallel : sendMode === "lastbyte" ? sendLastByte : sendAll}
            disabled={isSending}
            style={{ padding: "10px 22px", borderRadius: 10, background: isSending ? "#431407" : "#fb923c", color: isSending ? "#fb923c" : "#000", fontWeight: 800, fontSize: 13, border: "none", cursor: isSending ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
          >
            {isSending ? "Sending…" : `▶  Run ${payloads.length} payload${payloads.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </header>

      {/* 3-COLUMN GRID */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 260px 1fr", gap: 14, padding: 18, maxWidth: 1380, margin: "0 auto" }}>

        {/* COL 1 — CONFIG */}
        <div style={panelStyle}>
          <Field label="Target URL — {{payload}} works here">
            <input style={inputStyle} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://target.com/user/{{payload}}" />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Method">
              <select style={inputStyle} value={method} onChange={(e) => setMethod(e.target.value)}>
                {["GET","POST","PUT","PATCH","DELETE"].map(m => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Payload Mode">
              <select style={inputStyle} value={payloadMode} onChange={(e) => setPayloadMode(e.target.value)}>
                <option value="single">Single</option>
                <option value="numeric">Numeric</option>
                <option value="charset">Charset</option>
                <option value="manual">Manual</option>
              </select>
            </Field>
          </div>

          <Field label="Headers — {{payload}} works here">
            <textarea style={{ ...inputStyle, minHeight: 88, resize: "vertical" }} value={headersText} onChange={(e) => setHeadersText(e.target.value)} />
          </Field>

          <Field label="Cookie — {{payload}} works here">
            <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical" }} value={cookie} onChange={(e) => setCookie(e.target.value)} placeholder="session=abc; TrackingId={{payload}}" />
          </Field>

          <Field label={<>Body / Query — <span style={{ color: "#fb923c" }}>{"{{payload}}"}</span> works here</>}>
            <textarea style={{ ...inputStyle, minHeight: 68, resize: "vertical" }} value={bodyTemplate} onChange={(e) => setBodyTemplate(e.target.value)} />
          </Field>

          {payloadMode === "single" && (
            <Field label="Payload">
              <input style={inputStyle} value={singlePayload} onChange={(e) => setSinglePayload(e.target.value)} />
            </Field>
          )}
          {payloadMode === "numeric" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Field label="From"><input type="number" style={inputStyle} value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} /></Field>
              <Field label="To"><input type="number" style={inputStyle} value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} /></Field>
            </div>
          )}
          {payloadMode === "charset" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Field label="From"><input style={inputStyle} value={charFrom} maxLength={1} onChange={(e) => setCharFrom(e.target.value)} placeholder="a" /></Field>
              <Field label="To"><input style={inputStyle} value={charTo} maxLength={1} onChange={(e) => setCharTo(e.target.value)} placeholder="z" /></Field>
            </div>
          )}
          {payloadMode === "manual" && (
            <Field label="Payloads (one per line)">
              <textarea style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} value={manualList} onChange={(e) => setManualList(e.target.value)} />
            </Field>
          )}

          {/* Live preview */}
          <div style={{ background: "#000", borderRadius: 10, padding: 12, fontSize: 11, color: "#52525b", whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: 1.6 }}>
            <div style={{ color: "#fb923c", fontSize: 9, letterSpacing: 2, marginBottom: 6 }}>PREVIEW</div>
            {buildRequestPreview(payloads[0] ?? "", parseHeaders(headersText, payloads[0] ?? ""))}
          </div>
        </div>

        {/* COL 2 — HISTORY */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Notecard />
          <CsrfPoc
		  url={url}
		  method={method}
		  payloads={payloads}
		  buildRequest={buildRequest}
		  inputStyle={inputStyle}
		  panelStyle={panelStyle}
		/>
          <div style={{ ...panelStyle, overflowY: "auto", maxHeight: "calc(100vh - 90px)", padding: 14 }}>
            <div style={{ fontSize: 9, color: "#52525b", letterSpacing: 2, marginBottom: 10 }}>HISTORY ({history.length})</div>
            {isSending && (
              <button
                onClick={() => { stopRef.current = true; setShouldStop(true); }}
                style={{ width: "100%", padding: "8px", borderRadius: 8, background: "rgba(239,68,68,0.15)", color: "#f87171", fontWeight: 700, fontSize: 12, border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer", fontFamily: "inherit", marginBottom: 10 }}
              >
                Stop
              </button>
            )}
            {history.length === 0 && (
              <div style={{ color: "#27272a", fontSize: 12, textAlign: "center", marginTop: 50 }}>No requests yet</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setSelectedResponse(item); setInspectorTab("body"); }}
                  style={{
                    width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 10,
                    background: sel?.id === item.id ? "rgba(251,146,60,0.1)" : item.time > SLOW_MS ? "rgba(234,179,8,0.08)" : "rgba(255,255,255,0.03)",
                    border: sel?.id === item.id ? "1px solid rgba(251,146,60,0.35)" : item.time > SLOW_MS ? "1px solid rgba(234,179,8,0.3)" : "1px solid rgba(255,255,255,0.05)",
                    cursor: "pointer", fontFamily: "inherit", color: "#f4f4f5", transition: "all 0.1s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: "#a1a1aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110 }}>
                      {item.payload || "(empty)"}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: statusColor(item.status), flexShrink: 0 }}>
                      {item.status}
                    </span>
                    {item.race && (
                      <span style={{ fontSize: 9, color: "#a78bfa", letterSpacing: 1 }}>RACE</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: item.time > SLOW_MS ? "#eab308" : "#3f3f46" }}>
                    {item.size} B &nbsp;·&nbsp; {item.time} ms {item.time > SLOW_MS ? "⚠" : ""}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* COL 3 — INSPECTOR */}
        <div style={{ ...panelStyle, overflowY: "auto", maxHeight: "calc(100vh - 90px)" }}>
          {!sel ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#27272a", fontSize: 13 }}>
              Run a request to inspect results
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: 26, fontWeight: 900, color: statusColor(sel.status) }}>{sel.status}</span>
                <span style={{ fontSize: 11, color: "#71717a" }}>{sel.time} ms</span>
                <span style={{ fontSize: 11, color: "#71717a" }}>{sel.size} bytes</span>
                <span style={{ fontSize: 10, color: "#3f3f46", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>{sel.finalUrl}</span>
              </div>

              <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                {["body", "headers", "request"].map((tab) => (
                  <button key={tab} onClick={() => setInspectorTab(tab)} style={{
                    padding: "5px 14px", borderRadius: 7, border: "none", fontFamily: "inherit", fontSize: 11, cursor: "pointer", transition: "all 0.1s", textTransform: "capitalize",
                    background: inspectorTab === tab ? "#fb923c" : "rgba(255,255,255,0.06)",
                    color: inspectorTab === tab ? "#000" : "#71717a",
                    fontWeight: inspectorTab === tab ? 700 : 400,
                  }}>
                    {tab}
                  </button>
                ))}
              </div>

              {inspectorTab === "body" && <pre style={preStyle}>{sel.responseBody}</pre>}

              {inspectorTab === "headers" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {Object.keys(sel.responseHeaders).length === 0
                    ? <div style={{ color: "#52525b", fontSize: 12 }}>No headers captured</div>
                    : Object.entries(sel.responseHeaders).map(([k, v]) => (
                      <div key={k} style={{ display: "flex", gap: 10, fontSize: 12 }}>
                        <span style={{ color: "#fb923c", minWidth: 160, flexShrink: 0 }}>{k}</span>
                        <span style={{ color: "#d4d4d8", wordBreak: "break-all" }}>{v}</span>
                      </div>
                    ))
                  }
                </div>
              )}

              {inspectorTab === "request" && <pre style={preStyle}>{sel.requestPreview}</pre>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 9, color: "#71717a", letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}

const panelStyle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 16,
  padding: 18,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 9,
  background: "#09090b",
  border: "1px solid #27272a",
  color: "#f4f4f5",
  fontSize: 12,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const preStyle = {
  background: "#000",
  borderRadius: 10,
  padding: 14,
  fontSize: 12,
  color: "#d4d4d8",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  overflowY: "auto",
  maxHeight: "calc(100vh - 280px)",
  margin: 0,
  lineHeight: 1.65,
};
