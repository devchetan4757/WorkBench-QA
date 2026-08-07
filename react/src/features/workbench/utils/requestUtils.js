// requestUtils.js — pure functions, no React state. Everything here takes
// its inputs as arguments and returns a value, so it's easy to reason about
// and reuse (CsrfPoc consumes buildRequest indirectly through the hook).
import { CONTENT_TYPES } from "../constants";

// ─── Inject payload into any string ───────────────────────
export function injectPayload(template, payload) {
  return String(template).replaceAll("{{payload}}", payload);
}

// ─── Parse headers text → object ──────────────────────────
export function parseHeaders(text, payload, { cookie, contentType, method }) {
  const headers = {};
  const blocked = ["host", "content-length", "cookie", "origin"];
  text.split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx > -1) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (key && !blocked.includes(key.toLowerCase())) {
        headers[key] = injectPayload(val, payload);
      }
    }
  });
  if (cookie.trim()) {
    headers["Cookie"] = injectPayload(cookie.trim(), payload);
  }

  // Auto content-type header (unless user already set one)
  const hasContentType = Object.keys(headers).some((k) => k.toLowerCase() === "content-type");
  const ctMeta = CONTENT_TYPES.find((c) => c.id === contentType);
  if (!hasContentType && ctMeta?.header && method !== "GET") {
    headers["Content-Type"] = ctMeta.header;
  }

  return headers;
}

// ─── Generate payloads from the active payload mode ─────────
export function generatePayloads(mode, {
  singlePayload, rangeStart, rangeEnd, charFrom, charTo, manualList, urlPayloads,
}) {
  if (mode === "single") return [singlePayload];
  if (mode === "numeric") {
    const arr = [];
    for (let i = Number(rangeStart); i <= Number(rangeEnd); i++) arr.push(String(i));
    return arr;
  }
  if (mode === "charset") {
    const arr = [];
    const start = charFrom.charCodeAt(0);
    const end = charTo.charCodeAt(0);
    for (let i = start; i <= end; i++) arr.push(String.fromCharCode(i));
    return arr;
  }
  if (mode === "manual") {
    return manualList.split("\n").map((v) => v.trim()).filter(Boolean);
  }
  if (mode === "url") {
    return urlPayloads;
  }
  return [];
}

// ─── Build the final URL, combining base URL + query params ───
export function buildUrl(url, queryParams, payload) {
  const injectedUrl = injectPayload(url, payload);
  const injectedQuery = injectPayload(queryParams, payload).trim();
  if (!injectedQuery) return injectedUrl;
  const sep = injectedUrl.includes("?") ? "&" : "?";
  return injectedUrl + sep + injectedQuery;
}

// ─── Build the body, formatted according to content type ───
export function buildBody(bodyTemplate, contentType, payload) {
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

export function buildRequestPreview(method, targetUrl, headers, body) {
  let preview = `${method} ${targetUrl} HTTP/1.1\n`;
  Object.entries(headers).forEach(([k, v]) => { preview += `${k}: ${v}\n`; });
  preview += "\n";
  if (method !== "GET") preview += body;
  return preview;
}
