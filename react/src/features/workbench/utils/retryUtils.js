// retryUtils.js — 429 retry/backoff helpers, framework-agnostic where possible.

export function getHeaderCI(headers, name) {
  if (!headers) return undefined;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

// Retry-After can be seconds ("120") or an HTTP-date. Returns ms or null.
export function parseRetryAfter(value) {
  if (value === undefined || value === null || value === "") return null;
  const asSeconds = Number(value);
  if (!Number.isNaN(asSeconds)) return Math.max(0, asSeconds * 1000);
  const asDate = new Date(value);
  if (!Number.isNaN(asDate.getTime())) return Math.max(0, asDate.getTime() - Date.now());
  return null;
}

// Sleeps for `ms`, updating `onTick` each step so the UI can show a live
// countdown. Wakes up early once `stopRef.current` is true.
export function interruptibleSleepWithNotice(ms, source, stopRef, onTick) {
  return new Promise((resolve) => {
    if (ms <= 0) return resolve();
    const step = 250;
    let remaining = ms;
    onTick({ untilTs: Date.now() + ms, totalMs: ms, source });
    const interval = setInterval(() => {
      remaining -= step;
      if (stopRef.current || remaining <= 0) {
        clearInterval(interval);
        onTick(null);
        resolve();
      }
    }, step);
  });
}

// Sleeps for `ms`, but wakes up early and returns if the user hits Stop.
export function interruptibleSleep(ms, stopRef) {
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
