import { useState, useRef, useEffect, useCallback } from "react";
import { BACKEND, WORDLISTS } from "../constants";
import { buildPaths, parseFilterCodes, parseHeadersText } from "../utils/reconUtils";

export function useReconScan() {
  const [targetUrl, setTargetUrl] = useState("https://..");

  // wordlist state
  const [selectedWordlistKey, setSelectedWordlistKey] = useState("Common (dirb)");
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

  // which pane is on screen on a phone (desktop shows all three)
  const [activePane, setActivePane] = useState("config");

  const stopRef = useRef(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // ── Load wordlist from URL ───────────────────────────────────
  const loadWordlist = useCallback(async (key) => {
    setSelectedWordlistKey(key);
    setWordlistError("");
    const listUrl = WORDLISTS[key];
    if (!listUrl) {
      // Custom — keep whatever is in the textarea
      return;
    }
    setLoadingWordlist(true);
    try {
      const res = await fetch(listUrl);
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

  const paths = buildPaths(wordlist, useExtensions, extensions);

  // ── Run scan ─────────────────────────────────────────────────
  async function runRecon() {
    if (isRunning) return;
    if (!paths.length) {
      alert("Wordlist is empty — select a source or type custom paths");
      return;
    }
    if (!targetUrl.trim().startsWith("http")) {
      alert("Enter a valid base URL starting with http:// or https://");
      return;
    }

    const base = targetUrl.replace(/\/$/, "");
    const filtered = parseFilterCodes(filterCodes);
    const headers = parseHeadersText(customHeaders);

    stopRef.current = false;
    setIsRunning(true);
    setResults([]);
    setSelectedResult(null);
    setProgress({ done: 0, total: paths.length });
    setElapsed(0);
    if (window.innerWidth < 880) setActivePane("results");

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
            fd.append("follow_redirects", followRedirects ? "true" : "false");

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

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  const findings = results.filter((r) => {
    const s = r.status;
    if (filterTab === "all") return true;
    if (filterTab === "2xx") return typeof s === "number" && s >= 200 && s < 300;
    if (filterTab === "3xx") return typeof s === "number" && s >= 300 && s < 400;
    if (filterTab === "auth") return s === 401 || s === 403;
    if (filterTab === "err") return s === "ERR" || s === "TIMEOUT" || (typeof s === "number" && s >= 500);
    return true;
  });

  const countByTab = {
    all: results.length,
    "2xx": results.filter((r) => typeof r.status === "number" && r.status >= 200 && r.status < 300).length,
    "3xx": results.filter((r) => typeof r.status === "number" && r.status >= 300 && r.status < 400).length,
    auth: results.filter((r) => r.status === 401 || r.status === 403).length,
    err: results.filter((r) => r.status === "ERR" || r.status === "TIMEOUT" || (typeof r.status === "number" && r.status >= 500)).length,
  };

  useEffect(() => {
    if (selectedResult && window.innerWidth < 880) setActivePane("inspector");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedResult?.id]);

  function downloadCsv() {
    const csv = [
      "path,status,size,time_ms,url",
      ...results.map((r) => `${r.path},${r.status},${r.size},${r.time},"${r.finalUrl}"`),
    ].join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "recon_results.csv";
    a.click();
  }

  return {
    targetUrl, setTargetUrl,
    selectedWordlistKey, wordlist, setWordlist, loadingWordlist, wordlistError, loadWordlist,
    extensions, setExtensions, useExtensions, setUseExtensions,
    threads, setThreads, followRedirects, setFollowRedirects,
    filterCodes, setFilterCodes, customHeaders, setCustomHeaders,
    results, isRunning, progress, pct, elapsed,
    selectedResult, setSelectedResult, filterTab, setFilterTab, inspectorTab, setInspectorTab,
    activePane, setActivePane,
    paths, findings, countByTab,
    runRecon, stopRecon, downloadCsv,
  };
}

