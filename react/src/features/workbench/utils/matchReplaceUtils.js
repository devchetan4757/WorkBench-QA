// matchReplaceUtils.js — pure functions, no React state, same style as
// requestUtils.js. Applied once, right after buildRequest() assembles the
// URL/headers/body, so every send path (sequential, parallel, last-byte,
// preview, CSRF PoC) gets the same rules for free without each one having
// to know Match & Replace exists.

// A rule: { id, enabled, scope: 'url' | 'headers' | 'body', find, replace, isRegex }

function applyOne(str, rule) {
  if (!rule.enabled || !rule.find) return str;
  try {
    if (rule.isRegex) {
      return str.replace(new RegExp(rule.find, "g"), rule.replace ?? "");
    }
    return str.split(rule.find).join(rule.replace ?? "");
  } catch {
    // invalid regex — skip this rule rather than break the request
    return str;
  }
}

// Headers are an object ({ "Header-Name": "value" }); rules operate on the
// raw "Name: value" text block (same mental model as editing raw headers
// in Burp) and get re-parsed back into an object afterward. This lets a
// single rule touch a header's value, its name, or add/remove a line.
function headersToText(headers) {
  return Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join("\n");
}

function textToHeaders(text) {
  const out = {};
  text.split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx > -1) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (k) out[k] = v;
    }
  });
  return out;
}

export function applyMatchReplace(rules, { targetUrl, body, parsedHeaders }) {
  if (!rules || rules.length === 0) return { targetUrl, body, parsedHeaders };

  let nextUrl = targetUrl;
  let nextBody = body;
  let headersText = headersToText(parsedHeaders);

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.scope === "url") nextUrl = applyOne(nextUrl, rule);
    else if (rule.scope === "body") nextBody = applyOne(nextBody, rule);
    else if (rule.scope === "headers") headersText = applyOne(headersText, rule);
  }

  return {
    targetUrl: nextUrl,
    body: nextBody,
    parsedHeaders: textToHeaders(headersText),
  };
}
