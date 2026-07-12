import CsrfPoc from "./CsrfPoc";
import { useState, useMemo, useRef, useEffect } from "react";
import Notecard from "./Notecard";
import Recon from "./Recon";

const BACKEND = "http://localhost:5000";

const CONTENT_TYPES = [
  { id: "json", label: "JSON", header: "application/json" },
  { id: "raw", label: "Raw", header: "" },
  { id: "form", label: "Form URL-Encoded", header: "application/x-www-form-urlencoded" },
  { id: "xml", label: "XML", header: "application/xml" },
  { id: "text", label: "Text/HTML", header: "text/plain" },
];

export default function App() {
  const [appMode, setAppMode] = useState("workbench");
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [headersText, setHeadersText] = useState("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
  const [cookie, setCookie] = useState("");

  // ─── Query params are now separate from body ───────────────
  const [queryParams, setQueryParams] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState('{"TrackingId": "test{{payload}}"}');
  const [contentType, setContentType] = useState("json");

  const [payloadMode, setPayloadMode] = useState("single");
  const [singlePayload, setSinglePayload] = useState("1");
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(5);
  const [charFrom, setCharFrom] = useState("a");
  const [charTo, setCharTo] = useState("z");
  const [manualList, setManualList] = useState("1\n2\n3");

  // ─── URL / dictionary-file payload source ───────────────────
  const [dictUrl, setDictUrl] = useState("");
  const [urlPayloads, setUrlPayloads] = useState([]);
  const [dictFetchStatus, setDictFetchStatus] = useState("idle"); // idle | loading | done | error
  const [dictFetchError, setDictFetchError] = useState("");
  const [dictFetchMeta, setDictFetchMeta] = useState(null); // { count, truncated }

  const [shouldStop, setShouldStop] = useState(false);
  const [sendMode, setSendMode] = useState("sequential");
  const [history, setHistory] = useState([]);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [inspectorTab, setInspectorTab] = useState("body");
  const stopRef = useRef(false);
  const SLOW_MS = 2000;

  // ─── Delay between requests (sequential mode) — helps avoid 429s ───
  const [delayMs, setDelayMs] = useState(0);

  // ─── Auto-backoff on 429 (sequential mode) ──────────────────
  // No Retry-After header? Start short and double each consecutive 429
  // on the SAME payload, up to a cap, instead of guessing one fixed wait.
  const BASE_429_MS = 2000;      // first fallback wait when no Retry-After
  const MAX_429_MS = 60000;      // cap for exponential backoff
  const MAX_429_RETRIES = 5;     // give up on a payload after this many 429s
  const [backoffNotice, setBackoffNotice] = useState(null); // { untilTs, totalMs, source }

  function getHeaderCI(headers, name) {
    if (!headers) return undefined;
    const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
    return key ? headers[key] : undefined;
  }

  // Retry-After can be seconds ("120") or an HTTP-date. Returns ms or null.
  function parseRetryAfter(value) {
    if (value === undefined || value === null || value === "") return null;
    const asSeconds = Number(value);
    if (!Number.isNaN(asSeconds)) return Math.max(0, asSeconds * 1000);
    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime())) return Math.max(0, asDate.getTime() - Date.now());
    return null;
  }

  // Sleeps for `ms`, updating backoffNotice each tick so the UI can show a
  // live countdown. Wakes up early if the user hits Stop.
  function interruptibleSleepWithNotice(ms, source) {
    return new Promise((resolve) => {
      if (ms <= 0) return resolve();
      const step = 250;
      let remaining = ms;
      setBackoffNotice({ untilTs: Date.now() + ms, totalMs: ms, source });
      const interval = setInterval(() => {
        remaining -= step;
        if (stopRef.current || remaining <= 0) {
          clearInterval(interval);
          setBackoffNotice(null);
          resolve();
        }
      }, step);
    });
  }

  // Sleeps for `ms`, but wakes up early and returns if the user hits Stop.
  function interruptibleSleep(ms) {
    return new Promise((resolve) => {
      if (ms <= 0) return resolve();
      const step = 50;
      let waited = 0;
      const interval = setInterval(() => {
        waited += step;
        if (stopRef.current || waited >= ms) {
          clearInterval(interval);
          resolve();
        }
      }, step);
    });
  }

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

    // ─── Auto content-type header (unless user already set one) ───
    const hasContentType = Object.keys(headers).some((k) => k.toLowerCase() === "content-type");
    const ctMeta = CONTENT_TYPES.find((c) => c.id === contentType);
    if (!hasContentType && ctMeta?.header && method !== "GET") {
      headers["Content-Type"] = ctMeta.header;
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
    if (payloadMode === "url") {
      return urlPayloads;
    }
    return [];
  }

  const payloads = useMemo(
    () => generatePayloads(),
    [payloadMode, singlePayload, rangeStart, rangeEnd, charFrom, charTo, manualList, urlPayloads]
  );

  // ─── Fetch a wordlist/dictionary file from a URL via backend proxy ───
  // (done server-side to avoid CORS issues with arbitrary third-party hosts)
  async function fetchDictionary() {
    if (!dictUrl.trim()) { alert("Enter a dictionary/wordlist URL"); return; }
    setDictFetchStatus("loading");
    setDictFetchError("");
    setDictFetchMeta(null);

    try {
      const res = await fetch(`${BACKEND}/api/fetch-wordlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: dictUrl.trim() }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setDictFetchStatus("error");
        setDictFetchError(data.error || `HTTP ${res.status}`);
        setUrlPayloads([]);
        return;
      }

      setUrlPayloads(data.lines || []);
      setDictFetchMeta({ count: data.count ?? (data.lines || []).length, truncated: !!data.truncated });
      setDictFetchStatus("done");
    } catch (err) {
      setDictFetchStatus("error");
      setDictFetchError(String(err));
      setUrlPayloads([]);
    }
  }

  // ─── Build the final URL, combining base URL + query params ───
  function buildUrl(payload) {
    const injectedUrl = injectPayload(url, payload);
    const injectedQuery = injectPayload(queryParams, payload).trim();
    if (!injectedQuery) return injectedUrl;
    const sep = injectedUrl.includes("?") ? "&" : "?";
    return injectedUrl + sep + injectedQuery;
  }

  // ─── Build the body, formatted according to content type ───
  function buildBody(payload) {
    const raw = injectPayload(bodyTemplate, payload);
    if (contentType === "json") {
      // Try to pretty/validate JSON, but never block sending on invalid JSON —
      // the payload itself may intentionally break the JSON (e.g. fuzzing).
      try {
        const parsed = JSON.parse(raw);
        return JSON.stringify(parsed);
      } catch {
        return raw;
      }
    }
    return raw;
  }

  function buildRequestPreview(payload, headers) {
    const targetUrl = buildUrl(payload);
    const body = buildBody(payload);
    let preview = `${method} ${targetUrl} HTTP/1.1\n`;
    Object.entries(headers).forEach(([k, v]) => { preview += `${k}: ${v}\n`; });
    preview += "\n";
    if (method !== "GET") preview += body;
    return preview;
  }

  // ─── Build request parts for a given payload ───────────────
  function buildRequest(payload) {
    const parsedHeaders = parseHeaders(headersText, payload);
    const body = buildBody(payload);
    const targetUrl = buildUrl(payload);
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
  async function sendOnce(payload) {
    const { parsedHeaders, body, targetUrl } = buildRequest(payload);
    const requestPreview = buildRequestPreview(payload, parsedHeaders);

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

      return {
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
      return {
        id: Date.now() + Math.random(),
        payload, requestPreview,
        status: "ERROR", time: 0, finalUrl: targetUrl,
        responseHeaders: {}, size: 0,
        responseBody: `Network error: ${String(networkErr)}`,
      };
    }
  }

  async function sendAll() {
    stopRef.current = false;
    setShouldStop(false);
    if (!url.trim()) { alert("Enter a target URL"); return; }
    setIsSending(true);
    setHistory([]);
    setSelectedResponse(null);

    for (const payload of payloads) {
      if (stopRef.current) break;

      let result = null;
      let attempt = 0;
      let backoffMs = BASE_429_MS;

      // ─── Retry loop: keep hitting the SAME payload while 429'd ───
      while (!stopRef.current) {
        result = await sendOnce(payload);

        if (result.status !== 429) break;          // success/other status → done retrying
        if (attempt >= MAX_429_RETRIES) {           // give up on this payload
          result.retriesExhausted = true;
          result.retryAttempts = attempt;
          break;
        }

        attempt += 1;
        const retryHeaderVal = getHeaderCI(result.responseHeaders, "Retry-After");
        const parsedWait = parseRetryAfter(retryHeaderVal);
        const waitMs = parsedWait ?? backoffMs;
        await interruptibleSleepWithNotice(
          waitMs,
          parsedWait != null
            ? `Retry-After header — retry ${attempt}/${MAX_429_RETRIES} on this payload`
            : `exponential backoff — retry ${attempt}/${MAX_429_RETRIES} on this payload`
        );
        backoffMs = Math.min(backoffMs * 2, MAX_429_MS); // only grows when no Retry-After given
        // loop continues → re-sends the SAME payload, does not advance
      }

      if (!result) break; // stopped before we got any response at all

      result.retryAttempts = result.retryAttempts ?? attempt;
      setHistory((prev) => [result, ...prev]);
      setSelectedResponse((prev) => prev ?? result);

      // ─── Normal delay before moving to the NEXT payload ───
      if (delayMs > 0 && !stopRef.current) {
        await interruptibleSleep(delayMs);
      }
    }

    setIsSending(false);
    setBackoffNotice(null);
  }

  // ─── PARALLEL (gated race via /api/race) ────────────────────
  async function sendParallel() {
    if (!url.trim()) { alert("Enter a target URL"); return; }
    setIsSending(true);
    setHistory([]);
    setSelectedResponse(null);

    // Build all request parts up front so the backend can fire them
    // through its asyncio.Event gate as close to simultaneously as possible.
    const built = payloads.map((payload) => {
      const { parsedHeaders, body, targetUrl } = buildRequest(payload);
      return {
        payload,
        parsedHeaders,
        requestPreview: buildRequestPreview(payload, parsedHeaders),
        requestBody: {
          url: targetUrl,
          method,
          headers: parsedHeaders,
          body: method !== "GET" ? body : "",
        },
      };
    });

    let mapped;
    try {
      const res = await fetch(`${BACKEND}/api/race`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests: built.map((b) => b.requestBody) }),
      });
      const results = await res.json();

      mapped = built.map((b, i) => {
        const r = results[i] ?? {};
        return {
          id: Date.now() + i + Math.random(),
          payload: b.payload,
          requestPreview: b.requestPreview,
          status: r.status ?? "ERROR",
          time: r.time ?? 0,
          finalUrl: r.final_url ?? b.requestBody.url,
          responseHeaders: r.headers ?? {},
          responseBody: String(r.body ?? "(empty body)"),
          size: r.size ?? 0,
          race: true,
        };
      });
    } catch (networkErr) {
      mapped = built.map((b) => ({
        id: Date.now() + Math.random(),
        payload: b.payload,
        requestPreview: b.requestPreview,
        status: "ERROR",
        time: 0,
        finalUrl: b.requestBody.url,
        responseHeaders: {},
        responseBody: `Network error: ${String(networkErr)}`,
        size: 0,
        race: true,
      }));
    }

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
          <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid #27272a", marginTop: 8 }}>
            {[
              { id: "workbench", label: "⚡ Workbench" },
              { id: "recon",     label: "🔍 Recon" },
            ].map(({ id, label }) => (
              <button key={id} onClick={() => setAppMode(id)} style={{
                padding: "6px 12px", border: "none", fontFamily: "inherit",
                fontSize: 10, cursor: "pointer",
                background: appMode === id ? "#a78bfa" : "rgba(255,255,255,0.04)",
                color: appMode === id ? "#000" : "#71717a",
                fontWeight: appMode === id ? 700 : 400,
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {appMode === "workbench" && <>
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
                  {mode === "sequential" ? "⏩ Sequential" : mode === "parallel" ? "⚡ Parallel" : " 🎯 Last-Byte"}
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
          </>}
        </div>
      </header>

      {appMode === "recon" ? (
        <Recon />
      ) : (
        <>
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
                    <option value="url">URL / Dictionary File</option>
                  </select>
                </Field>
              </div>

              <Field label="Delay between requests (ms) — sequential mode only, helps avoid 429s">
                <input
                  type="number"
                  min="0"
                  step="100"
                  style={inputStyle}
                  value={delayMs}
                  onChange={(e) => setDelayMs(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0"
                />
              </Field>

              <Field label="Headers — {{payload}} works here">
                <textarea style={{ ...inputStyle, minHeight: 88, resize: "vertical" }} value={headersText} onChange={(e) => setHeadersText(e.target.value)} />
              </Field>

              <Field label="Cookie — {{payload}} works here">
                <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical" }} value={cookie} onChange={(e) => setCookie(e.target.value)} placeholder="session=abc; TrackingId={{payload}}" />
              </Field>

              {/* ─── Query Params — separate from Body now ─── */}
              <Field label={<>Query Params — <span style={{ color: "#fb923c" }}>{"{{payload}}"}</span> works here</>}>
                <textarea
                  style={{ ...inputStyle, minHeight: 50, resize: "vertical" }}
                  value={queryParams}
                  onChange={(e) => setQueryParams(e.target.value)}
                  placeholder="foo=bar&trackingId={{payload}}"
                />
              </Field>

              {/* ─── Body with content type selector ─── */}
              <Field label="Body Content-Type">
                <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid #27272a" }}>
                  {CONTENT_TYPES.map((ct) => (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() => setContentType(ct.id)}
                      title={ct.header || "no header override"}
                      style={{
                        flex: 1, padding: "6px 4px", border: "none", fontFamily: "inherit",
                        fontSize: 9.5, cursor: "pointer",
                        background: contentType === ct.id ? "#a78bfa" : "rgba(255,255,255,0.04)",
                        color: contentType === ct.id ? "#000" : "#71717a",
                        fontWeight: contentType === ct.id ? 700 : 400,
                      }}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label={<>Body — <span style={{ color: "#fb923c" }}>{"{{payload}}"}</span> works here{method === "GET" && <span style={{ color: "#52525b" }}> (ignored for GET)</span>}</>}>
                <textarea
                  style={{ ...inputStyle, minHeight: 90, resize: "vertical", opacity: method === "GET" ? 0.5 : 1 }}
                  value={bodyTemplate}
                  onChange={(e) => setBodyTemplate(e.target.value)}
                  disabled={method === "GET"}
                />
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
              {payloadMode === "url" && (
                <Field label="Dictionary / Wordlist URL — one payload per line">
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      style={inputStyle}
                      value={dictUrl}
                      onChange={(e) => setDictUrl(e.target.value)}
                      placeholder="https://example.com/wordlist.txt"
                    />
                    <button
                      type="button"
                      onClick={fetchDictionary}
                      disabled={dictFetchStatus === "loading"}
                      style={{
                        padding: "8px 12px", borderRadius: 8, border: "none", fontFamily: "inherit",
                        fontSize: 11, fontWeight: 700, cursor: dictFetchStatus === "loading" ? "not-allowed" : "pointer",
                        background: dictFetchStatus === "loading" ? "#3f3f46" : "#a78bfa",
                        color: dictFetchStatus === "loading" ? "#a1a1aa" : "#000",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {dictFetchStatus === "loading" ? "Fetching…" : "Fetch"}
                    </button>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10 }}>
                    {dictFetchStatus === "done" && dictFetchMeta && (
                      <span style={{ color: "#34d399" }}>
                        Loaded {dictFetchMeta.count} payload{dictFetchMeta.count !== 1 ? "s" : ""}
                        {dictFetchMeta.truncated ? " (truncated to size limit)" : ""}
                      </span>
                    )}
                    {dictFetchStatus === "error" && (
                      <span style={{ color: "#f87171" }}>Failed: {dictFetchError}</span>
                    )}
                    {dictFetchStatus === "idle" && (
                      <span style={{ color: "#52525b" }}>Fetched server-side to avoid CORS issues.</span>
                    )}
                  </div>
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
                {backoffNotice && <BackoffBanner notice={backoffNotice} />}
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
                        {item.retriesExhausted && (
                          <span style={{ fontSize: 9, color: "#f87171", letterSpacing: 1 }} title={`Gave up after ${item.retryAttempts} retries — still 429`}>
                            MAX RETRIES
                          </span>
                        )}
                        {!item.retriesExhausted && item.retryAttempts > 0 && (
                          <span style={{ fontSize: 9, color: "#eab308", letterSpacing: 1 }} title={`Succeeded after ${item.retryAttempts} 429 retr${item.retryAttempts === 1 ? "y" : "ies"}`}>
                            RETRIED ×{item.retryAttempts}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: item.time > SLOW_MS ? "#eab308" : "#3f3f46" }}>
                        {item.time}ms · {item.size}b
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* COL 3 — INSPECTOR */}
            <div style={{ ...panelStyle, overflowY: "auto", maxHeight: "calc(100vh - 90px)" }}>
              {!sel ? (
                <div style={{ color: "#27272a", fontSize: 13, textAlign: "center", marginTop: 100 }}>
                  Select a response to inspect
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: statusColor(sel.status) }}>{sel.status}</span>
                    <span style={{ fontSize: 11, color: "#71717a" }}>{sel.time}ms · {sel.size}b</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    {["body", "headers", "request"].map((tab) => (
                      <button key={tab} onClick={() => setInspectorTab(tab)} style={{
                        padding: "6px 12px", borderRadius: 8, border: "none", fontFamily: "inherit",
                        fontSize: 11, cursor: "pointer",
                        background: inspectorTab === tab ? "#fb923c" : "rgba(255,255,255,0.05)",
                        color: inspectorTab === tab ? "#000" : "#a1a1aa",
                      }}>
                        {tab}
                      </button>
                    ))}
                  </div>
                  <pre style={{ background: "#000", borderRadius: 10, padding: 14, fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: 1.6, color: "#d4d4d8" }}>
                    {inspectorTab === "body" && sel.responseBody}
                    {inspectorTab === "headers" && JSON.stringify(sel.responseHeaders, null, 2)}
                    {inspectorTab === "request" && sel.requestPreview}
                  </pre>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BackoffBanner({ notice }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, notice.untilTs - now);
  const remainingS = (remainingMs / 1000).toFixed(1);

  return (
    <div style={{
      background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.35)",
      borderRadius: 8, padding: "8px 10px", marginBottom: 10, fontSize: 11, color: "#eab308",
    }}>
      ⏳ 429 rate limited — waiting {remainingS}s ({notice.source}) before next request
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: "#71717a", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

const panelStyle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
  padding: 16,
};

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #27272a",
  background: "#0a0a0a",
  color: "#f4f4f5",
  fontFamily: "inherit",
  fontSize: 12,
  boxSizing: "border-box",
};
