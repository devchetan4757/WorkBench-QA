import { useState, useMemo, useRef, useEffect } from "react";
import { BACKEND, BASE_429_MS, MAX_429_MS, MAX_429_RETRIES } from "../constants";
import {
  parseHeaders, generatePayloads, buildUrl, buildBody, buildRequestPreview,
} from "../utils/requestUtils";
import {
  getHeaderCI, parseRetryAfter, interruptibleSleep, interruptibleSleepWithNotice,
} from "../utils/retryUtils";
import { applyMatchReplace } from "../utils/matchReplaceUtils";
import { useMatchReplace } from "./useMatchReplace";

export function useWorkbench() {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [headersText, setHeadersText] = useState("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
  const [cookie, setCookie] = useState("");

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

  const [sendMode, setSendMode] = useState("sequential");
  const [history, setHistory] = useState([]);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [inspectorTab, setInspectorTab] = useState("body");
  const stopRef = useRef(false);

  // ─── Which pane is on screen on a phone (desktop shows all three) ───
  const [activePane, setActivePane] = useState("request");

  // ─── Delay between requests (sequential mode) — helps avoid 429s ───
  const [delayMs, setDelayMs] = useState(0);
  const [backoffNotice, setBackoffNotice] = useState(null); // { untilTs, totalMs, source }

  // ─── Match & Replace — rules auto-applied to every built request ───
  const matchReplace = useMatchReplace();

  const payloads = useMemo(
    () => generatePayloads(payloadMode, {
      singlePayload, rangeStart, rangeEnd, charFrom, charTo, manualList, urlPayloads,
    }),
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

  // ─── The single choke point every send path (and CSRF PoC) goes
  // through — Match & Replace rules are applied here so nothing else
  // needs to know the feature exists. ───────────────────────────────
  function buildRequest(payload) {
    const parsedHeaders = parseHeaders(headersText, payload, { cookie, contentType, method });
    const body = buildBody(bodyTemplate, contentType, payload);
    const targetUrl = buildUrl(url, queryParams, payload);
    return applyMatchReplace(matchReplace.rules, { parsedHeaders, body, targetUrl });
  }

  function previewFor(payload) {
    const { parsedHeaders, body, targetUrl } = buildRequest(payload);
    return buildRequestPreview(method, targetUrl, parsedHeaders, body);
  }

  // ─── SEQUENTIAL ────────────────────────────────────────────
  async function sendOnce(payload) {
    const { parsedHeaders, body, targetUrl } = buildRequest(payload);
    const requestPreview = buildRequestPreview(method, targetUrl, parsedHeaders, body);

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
            : `exponential backoff — retry ${attempt}/${MAX_429_RETRIES} on this payload`,
          stopRef,
          setBackoffNotice,
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
        await interruptibleSleep(delayMs, stopRef);
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
        requestPreview: buildRequestPreview(method, targetUrl, parsedHeaders, body),
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
      requestPreview: previewFor(payloads[i]),
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

  function stopSending() {
    stopRef.current = true;
  }

  function clearHistory() {
    setHistory([]);
    setSelectedResponse(null);
  }

  // Jump to the response pane automatically once something is selected —
  // saves a tap on mobile after Run finishes.
  useEffect(() => {
    if (selectedResponse && window.innerWidth < 880) setActivePane("response");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedResponse?.id]);

  return {
    // request config
    method, setMethod, url, setUrl, headersText, setHeadersText, cookie, setCookie,
    queryParams, setQueryParams, bodyTemplate, setBodyTemplate, contentType, setContentType,
    // payload config
    payloadMode, setPayloadMode, singlePayload, setSinglePayload,
    rangeStart, setRangeStart, rangeEnd, setRangeEnd,
    charFrom, setCharFrom, charTo, setCharTo, manualList, setManualList,
    dictUrl, setDictUrl, dictFetchStatus, dictFetchError, dictFetchMeta, fetchDictionary,
    delayMs, setDelayMs,
    payloads,
    // match & replace
    matchReplaceRules: matchReplace.rules,
    addMatchReplaceRule: matchReplace.addRule,
    updateMatchReplaceRule: matchReplace.updateRule,
    removeMatchReplaceRule: matchReplace.removeRule,
    toggleMatchReplaceRule: matchReplace.toggleRule,
    // sending
    sendMode, setSendMode, isSending, sendAll, sendParallel, sendLastByte, stopSending,
    backoffNotice,
    // history / inspector
    history, clearHistory, selectedResponse, setSelectedResponse, inspectorTab, setInspectorTab,
    // layout
    activePane, setActivePane,
    // helpers panes need
    buildRequest, previewFor,
  };
}
