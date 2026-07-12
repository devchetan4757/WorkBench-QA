import { useState, useRef, useEffect, useCallback } from "react";

const BACKEND = "http://localhost:5000";

// ── Online wordlists ─────────────────────────────────────────
const WORDLISTS = {
  "Common (dirb)":
    "https://raw.githubusercontent.com/v0re/dirb/master/wordlists/common.txt",
  "Small (dirbuster)":
    "https://raw.githubusercontent.com/daviddias/node-dirbuster/master/lists/directory-list-2.3-small.txt",
  "Medium (dirbuster)":
    "https://raw.githubusercontent.com/daviddias/node-dirbuster/master/lists/directory-list-2.3-medium.txt",
  "API endpoints (SecLists)":
    "https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/api/api-endpoints.txt",
  "Web content (raft-small)":
    "https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/raft-small-words.txt",
  "Custom (type below)": null,
};

// ── Shared styles ────────────────────────────────────────────
const inputStyle = {
  width: "100%",
  background: "#09090b",
  border: "1px solid #27272a",
  borderRadius: 8,
  color: "#f4f4f5",
  padding: "8px 10px",
  fontFamily: "'JetBrains Mono','Fira Code',monospace",
  fontSize: 12,
  outline: "none",
  boxSizing: "border-box",
};

const panelStyle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 14,
  padding: 18,
};

// ── Helpers ──────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label
        style={{
          fontSize: 10,
          color: "#52525b",
          letterSpacing: 1.5,
          textTransform: "uppercase",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function statusColor(s) {
  if (!s || s === "ERR") return "#f87171";
  if (s === "TIMEOUT") return "#f59e0b";
  if (s >= 200 && s < 300) return "#34d399";
  if (s >= 300 && s < 400) return "#a78bfa";
  if (s === 401 || s === 403) return "#fb923c";
  if (s >= 500) return "#f87171";
  return "#60a5fa";
}

function statusBg(s) {
  if (!s || s === "ERR") return "rgba(248,113,113,0.06)";
  if (s >= 200 && s < 300) return "rgba(52,211,153,0.06)";
  if (s >= 300 && s < 400) return "rgba(167,139,250,0.06)";
  if (s === 401 || s === 403) return "rgba(251,146,60,0.06)";
  return "transparent";
}

// ── Component ────────────────────────────────────────────────
export default function Recon() {
  const [targetUrl, setTargetUrl] = useState("https://..");

  // wordlist state
  const [selectedWordlistKey, setSelectedWordlistKey] = useState(
    "Common (dirb)"
  );
  const [wordlist, setWordlist] = useState("");
  const [loadingWordlist, setLoadingWordlist] = useState(false);
  const [wordlistError, setWordlistError] = useState("");

  // options
  const [extensions, setExtensions] = useState("");
  const [useExtensions, setUseExtensions] = useState(false);
  const [threads, setThreads] = useState(20);
  const [followRedirects, setFollowRedirects] = useState(false);
  const [filterCodes, setFilterCodes] = useState("404");
  const [customHeaders, setCustomHeaders] = useState(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  );

  // scan state
  const [results, setResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [selectedResult, setSelectedResult] = useState(null);
  const [filterTab, setFilterTab] = useState("all");
  const [elapsed, setElapsed] = useState(0);
  const [inspectorTab, setInspectorTab] = useState("body");

  const stopRef = useRef(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // ── Load wordlist from URL ───────────────────────────────────
  const loadWordlist = useCallback(async (key) => {
    setSelectedWordlistKey(key);
    setWordlistError("");
    const url = WORDLISTS[key];
    if (!url) {
      // Custom — keep whatever is in the textarea
      return;
    }
    setLoadingWordlist(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));
      setWordlist(lines.join("\n"));
    } catch (e) {
      setWordlistError(`Failed to fetch: ${e.message}`);
    }
    setLoadingWordlist(false);
  }, []);

  // Load default wordlist on mount
  useEffect(() => {
    loadWordlist("Common (dirb)");
  }, [loadWordlist]);

  // ── Build paths ──────────────────────────────────────────────
  function buildPaths() {
    const base = wordlist
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (!useExtensions || !extensions.trim()) return base;

    const exts = extensions
      .split(",")
      .map((e) => e.trim().replace(/^\./, ""))
      .filter(Boolean);

    const expanded = [];
    base.forEach((p) => {
      expanded.push(p);
      exts.forEach((ext) => expanded.push(`${p}.${ext}`));
    });
    return expanded;
  }

  function parseFilterCodes() {
    return filterCodes
      .split(",")
      .map((c) => parseInt(c.trim(), 10))
      .filter(Number.isFinite);
  }

  function parseHeaders() {
    const h = {};
    customHeaders.split("\n").forEach((line) => {
      const idx = line.indexOf(":");
      if (idx > -1) {
        h[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    });
    return h;
  }

  // ── Run scan ─────────────────────────────────────────────────
  async function runRecon() {
    if (isRunning) return;
    const paths = buildPaths();
    if (!paths.length) {
      alert("Wordlist is empty — select a source or type custom paths");
      return;
    }
    if (!targetUrl.trim().startsWith("http")) {
      alert("Enter a valid base URL starting with http:// or https://");
      return;
    }

    const base = targetUrl.replace(/\/$/, "");
    const filtered = parseFilterCodes();
    const headers = parseHeaders();

    stopRef.current = false;
    setIsRunning(true);
    setResults([]);
    setSelectedResult(null);
    setProgress({ done: 0, total: paths.length });
    setElapsed(0);

    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 500);

    let done = 0;
    for (let i = 0; i < paths.length; i += threads) {
      if (stopRef.current) break;
      const batch = paths.slice(i, i + threads);

      const batchResults = await Promise.allSettled(
        batch.map(async (path) => {
          const url = `${base}/${path.replace(/^\//, "")}`;
          const start = Date.now();
          try {
            const fd = new FormData();
            fd.append("url", url);
            fd.append("method", "GET");
            fd.append("headers", JSON.stringify(headers));
            fd.append("body", "");
            fd.append(
              "follow_redirects",
              followRedirects ? "true" : "false"
            );

            const res = await fetch(`${BACKEND}/api/request`, {
              method: "POST",
              body: fd,
            });
            const data = await res.json();
            return {
              id: `${path}-${Date.now()}-${Math.random()}`,
              path,
              url,
              status: data.status,
              size: data.size ?? 0,
              time: data.time ?? Math.round(Date.now() - start),
              finalUrl: data.final_url ?? url,
              responseHeaders: data.headers ?? {},
              responseBody: data.body ?? "",
            };
          } catch (e) {
            return {
              id: `${path}-err-${Date.now()}`,
              path,
              url,
              status: "ERR",
              size: 0,
              time: Math.round(Date.now() - start),
              finalUrl: url,
              responseHeaders: {},
              responseBody: String(e),
            };
          }
        })
      );

      done += batch.length;
      setProgress({ done, total: paths.length });

      const mapped = batchResults.map((r) =>
        r.status === "fulfilled"
          ? r.value
          : {
              id: `err-${Date.now()}-${Math.random()}`,
              path: "?",
              url: "",
              status: "ERR",
              size: 0,
              time: 0,
              finalUrl: "",
              responseHeaders: {},
              responseBody: String(r.reason),
            }
      );

      const interesting = mapped.filter((r) => !filtered.includes(r.status));
      setResults((prev) => [...prev, ...interesting]);
    }

    clearInterval(timerRef.current);
    setIsRunning(false);
  }

  function stopRecon() {
    stopRef.current = true;
    clearInterval(timerRef.current);
    setIsRunning(false);
  }

  // ── Derived values ───────────────────────────────────────────
  const paths = buildPaths();
  const pct = progress.total
    ? Math.round((progress.done / progress.total) * 100)
    : 0;

  const findings = results.filter((r) => {
    const s = r.status;
    if (filterTab === "all") return true;
    if (filterTab === "2xx")
      return typeof s === "number" && s >= 200 && s < 300;
    if (filterTab === "3xx")
      return typeof s === "number" && s >= 300 && s < 400;
    if (filterTab === "auth") return s === 401 || s === 403;
    if (filterTab === "err")
      return (
        s === "ERR" ||
        s === "TIMEOUT" ||
        (typeof s === "number" && s >= 500)
      );
    return true;
  });

  const countByTab = {
    all: results.length,
    "2xx": results.filter(
      (r) => typeof r.status === "number" && r.status >= 200 && r.status < 300
    ).length,
    "3xx": results.filter(
      (r) => typeof r.status === "number" && r.status >= 300 && r.status < 400
    ).length,
    auth: results.filter((r) => r.status === 401 || r.status === 403).length,
    err: results.filter(
      (r) =>
        r.status === "ERR" ||
        r.status === "TIMEOUT" ||
        (typeof r.status === "number" && r.status >= 500)
    ).length,
  };

  const sel = selectedResult;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono','Fira Code',monospace",
        color: "#f4f4f5",
      }}
    >
      {/* Progress bar */}
      {isRunning && (
        <div style={{ height: 2, background: "#18181b", marginBottom: 0 }}>
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: "linear-gradient(90deg,#a78bfa,#38bdf8)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      )}

      {/* Toolbar row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexWrap: "wrap",
        }}
      >
        <input
          style={{ ...inputStyle, maxWidth: 320 }}
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="https://.."
        />

        <select
          style={{ ...inputStyle, maxWidth: 220 }}
          value={selectedWordlistKey}
          onChange={(e) => loadWordlist(e.target.value)}
        >
          {Object.keys(WORDLISTS).map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>

        {loadingWordlist && (
          <span style={{ fontSize: 11, color: "#a78bfa" }}>
            Fetching…
          </span>
        )}
        {wordlistError && (
          <span style={{ fontSize: 11, color: "#f87171" }}>
            {wordlistError}
          </span>
        )}
        {!loadingWordlist && !wordlistError && wordlist && (
          <span style={{ fontSize: 10, color: "#3f3f46" }}>
            {paths.length} paths
          </span>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {isRunning && (
            <span style={{ fontSize: 11, color: "#71717a" }}>
              <span style={{ color: "#a78bfa" }}>{progress.done}</span>/
              {progress.total} · {elapsed}s
            </span>
          )}
          {isRunning ? (
            <button
              onClick={stopRecon}
              style={{
                padding: "8px 18px",
                borderRadius: 10,
                background: "rgba(239,68,68,0.15)",
                color: "#f87171",
                fontWeight: 800,
                fontSize: 12,
                border: "1px solid rgba(239,68,68,0.3)",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ■ Stop
            </button>
          ) : (
            <button
              onClick={runRecon}
              disabled={loadingWordlist}
              style={{
                padding: "8px 18px",
                borderRadius: 10,
                background: loadingWordlist ? "#3f3f46" : "#a78bfa",
                color: "#000",
                fontWeight: 800,
                fontSize: 12,
                border: "none",
                cursor: loadingWordlist ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              ▶ Scan {paths.length} path{paths.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

      {/* Main 3-col grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr 360px",
          gap: 14,
          padding: 14,
        }}
      >
        {/* COL 1 — Config */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Custom wordlist editor */}
          {selectedWordlistKey === "Custom (type below)" && (
            <div style={panelStyle}>
              <div
                style={{
                  fontSize: 9,
                  color: "#52525b",
                  letterSpacing: 2,
                  marginBottom: 8,
                }}
              >
                CUSTOM WORDLIST
              </div>
              <textarea
                style={{ ...inputStyle, minHeight: 160, resize: "vertical" }}
                value={wordlist}
                onChange={(e) => setWordlist(e.target.value)}
                placeholder={"admin\nlogin\napi/v1\n.env"}
              />
              <div style={{ fontSize: 10, color: "#3f3f46", marginTop: 6 }}>
                {wordlist.split("\n").filter(Boolean).length} lines
              </div>
            </div>
          )}

          {/* Options */}
          <div style={panelStyle}>
            <div
              style={{
                fontSize: 9,
                color: "#52525b",
                letterSpacing: 2,
                marginBottom: 12,
              }}
            >
              OPTIONS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Field label="Threads (concurrent)">
                <input
                  type="number"
                  style={inputStyle}
                  value={threads}
                  min={1}
                  max={100}
                  onChange={(e) => setThreads(Number(e.target.value))}
                />
              </Field>

              <Field label="Filter status codes (hide)">
                <input
                  style={inputStyle}
                  value={filterCodes}
                  onChange={(e) => setFilterCodes(e.target.value)}
                  placeholder="404,400"
                />
              </Field>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  id="recon-redirects"
                  checked={followRedirects}
                  onChange={(e) => setFollowRedirects(e.target.checked)}
                  style={{ accentColor: "#a78bfa" }}
                />
                <label
                  htmlFor="recon-redirects"
                  style={{ fontSize: 11, color: "#71717a", cursor: "pointer" }}
                >
                  Follow redirects
                </label>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  id="recon-ext"
                  checked={useExtensions}
                  onChange={(e) => setUseExtensions(e.target.checked)}
                  style={{ accentColor: "#a78bfa" }}
                />
                <label
                  htmlFor="recon-ext"
                  style={{ fontSize: 11, color: "#71717a", cursor: "pointer" }}
                >
                  Append extensions
                </label>
              </div>

              {useExtensions && (
                <Field label="Extensions (comma-separated)">
                  <input
                    style={inputStyle}
                    value={extensions}
                    onChange={(e) => setExtensions(e.target.value)}
                    placeholder="php,html,txt,bak"
                  />
                </Field>
              )}
            </div>
          </div>

          {/* Headers */}
          <div style={panelStyle}>
            <div
              style={{
                fontSize: 9,
                color: "#52525b",
                letterSpacing: 2,
                marginBottom: 8,
              }}
            >
              HEADERS
            </div>
            <textarea
              style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
              value={customHeaders}
              onChange={(e) => setCustomHeaders(e.target.value)}
            />
          </div>

          {/* Summary */}
          <div
            style={{
              ...panelStyle,
              background: "rgba(167,139,250,0.05)",
              border: "1px solid rgba(167,139,250,0.15)",
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: "#a78bfa",
                letterSpacing: 2,
                marginBottom: 8,
              }}
            >
              SUMMARY
            </div>
            {[
              ["Wordlist", selectedWordlistKey.split(" (")[0]],
              ["Paths", paths.length],
              ["Threads", threads],
              ["Est. batches", Math.ceil(paths.length / threads) || 0],
              ["Filter codes", filterCodes || "none"],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  marginBottom: 4,
                }}
              >
                <span style={{ color: "#52525b" }}>{k}</span>
                <span
                  style={{
                    color: "#f4f4f5",
                    maxWidth: 120,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textAlign: "right",
                  }}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* COL 2 — Results table */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Filter tabs + CSV */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {[
              { key: "all", label: "All" },
              { key: "2xx", label: "2xx" },
              { key: "3xx", label: "3xx" },
              { key: "auth", label: "401/403" },
              { key: "err", label: "Errors" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterTab(key)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 7,
                  border:
                    filterTab === key
                      ? "1px solid rgba(167,139,250,0.4)"
                      : "1px solid rgba(255,255,255,0.06)",
                  background:
                    filterTab === key
                      ? "rgba(167,139,250,0.12)"
                      : "rgba(255,255,255,0.03)",
                  color: filterTab === key ? "#a78bfa" : "#52525b",
                  fontFamily: "inherit",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                {label}{" "}
                {countByTab[key] > 0 && (
                  <span
                    style={{
                      color: filterTab === key ? "#a78bfa" : "#3f3f46",
                    }}
                  >
                    ({countByTab[key]})
                  </span>
                )}
              </button>
            ))}

            {results.length > 0 && (
              <button
                onClick={() => {
                  const csv = [
                    "path,status,size,time_ms,url",
                    ...results.map(
                      (r) =>
                        `${r.path},${r.status},${r.size},${r.time},"${r.finalUrl}"`
                    ),
                  ].join("\n");
                  const a = document.createElement("a");
                  a.href =
                    "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
                  a.download = "recon_results.csv";
                  a.click();
                }}
                style={{
                  marginLeft: "auto",
                  padding: "5px 12px",
                  borderRadius: 7,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)",
                  color: "#71717a",
                  fontFamily: "inherit",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                ↓ CSV
              </button>
            )}
          </div>

          {/* Table */}
          <div
            style={{
              ...panelStyle,
              padding: 0,
              overflow: "hidden",
              flex: 1,
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "70px 1fr 80px 80px",
                padding: "8px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                fontSize: 9,
                color: "#3f3f46",
                letterSpacing: 2,
              }}
            >
              <span>STATUS</span>
              <span>PATH</span>
              <span style={{ textAlign: "right" }}>SIZE</span>
              <span style={{ textAlign: "right" }}>TIME</span>
            </div>

            <div
              style={{ overflowY: "auto", maxHeight: "calc(100vh - 280px)" }}
            >
              {findings.length === 0 && !isRunning && (
                <div
                  style={{
                    padding: 40,
                    textAlign: "center",
                    color: "#27272a",
                    fontSize: 13,
                  }}
                >
                  {results.length === 0
                    ? "Run a scan to see results"
                    : "No results match this filter"}
                </div>
              )}

              {isRunning && findings.length === 0 && (
                <div style={{ padding: 20, textAlign: "center" }}>
                  <div
                    style={{
                      color: "#a78bfa",
                      fontSize: 12,
                      marginBottom: 6,
                    }}
                  >
                    Scanning… {progress.done}/{progress.total}
                  </div>
                  <div style={{ fontSize: 10, color: "#3f3f46" }}>
                    Filtered codes are hidden
                  </div>
                </div>
              )}

              {findings.map((item) => (
                <div
                  key={item.id}
                  onClick={() =>
                    setSelectedResult(
                      sel?.id === item.id ? null : item
                    )
                  }
                  style={{
                    display: "grid",
                    gridTemplateColumns: "70px 1fr 80px 80px",
                    padding: "9px 14px",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    cursor: "pointer",
                    background:
                      sel?.id === item.id
                        ? "rgba(167,139,250,0.1)"
                        : statusBg(item.status),
                    transition: "background 0.1s",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 12,
                      color: statusColor(item.status),
                    }}
                  >
                    {item.status}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#d4d4d8",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    /{item.path}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#52525b",
                      textAlign: "right",
                    }}
                  >
                    {item.size > 0
                      ? item.size > 1024
                        ? `${(item.size / 1024).toFixed(1)}k`
                        : `${item.size}B`
                      : "—"}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: item.time > 2000 ? "#eab308" : "#52525b",
                      textAlign: "right",
                    }}
                  >
                    {item.time}ms
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COL 3 — Inspector */}
        <div
          style={{
            ...panelStyle,
            overflowY: "auto",
            maxHeight: "calc(100vh - 180px)",
          }}
        >
          {!sel ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#27272a",
                fontSize: 13,
                minHeight: 200,
              }}
            >
              Click a result to inspect
            </div>
          ) : (
            <>
              {/* Status line */}
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "baseline",
                  marginBottom: 12,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: statusColor(sel.status),
                  }}
                >
                  {sel.status}
                </span>
                <span style={{ fontSize: 11, color: "#71717a" }}>
                  {sel.time} ms
                </span>
                <span style={{ fontSize: 11, color: "#71717a" }}>
                  {sel.size} B
                </span>
              </div>

              {/* URL */}
              <div
                style={{
                  fontSize: 10,
                  color: "#52525b",
                  wordBreak: "break-all",
                  marginBottom: 14,
                  lineHeight: 1.6,
                }}
              >
                {sel.finalUrl}
              </div>

              {/* Tabs */}
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  marginBottom: 10,
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  paddingBottom: 8,
                }}
              >
                {["body", "headers"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setInspectorTab(tab)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 6,
                      border: "none",
                      background:
                        inspectorTab === tab
                          ? "rgba(167,139,250,0.15)"
                          : "transparent",
                      color:
                        inspectorTab === tab ? "#a78bfa" : "#52525b",
                      fontFamily: "inherit",
                      fontSize: 11,
                      cursor: "pointer",
                      fontWeight: inspectorTab === tab ? 700 : 400,
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Body */}
              {inspectorTab === "body" && (
                <pre
                  style={{
                    margin: 0,
                    fontSize: 11,
                    color: "#a1a1aa",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    lineHeight: 1.6,
                    maxHeight: "calc(100vh - 400px)",
                    overflowY: "auto",
                    background: "#000",
                    padding: 12,
                    borderRadius: 8,
                  }}
                >
                  {sel.responseBody || "(empty body)"}
                </pre>
              )}

              {/* Headers */}
              {inspectorTab === "headers" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    maxHeight: "calc(100vh - 400px)",
                    overflowY: "auto",
                  }}
                >
                  {Object.entries(sel.responseHeaders).length === 0 ? (
                    <span style={{ fontSize: 11, color: "#3f3f46" }}>
                      No headers
                    </span>
                  ) : (
                    Object.entries(sel.responseHeaders).map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "140px 1fr",
                          gap: 8,
                          fontSize: 11,
                          lineHeight: 1.5,
                        }}
                      >
                        <span
                          style={{
                            color: "#a78bfa",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {k}
                        </span>
                        <span
                          style={{
                            color: "#d4d4d8",
                            wordBreak: "break-all",
                          }}
                        >
                          {v}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
