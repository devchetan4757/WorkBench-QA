export { BACKEND } from "../../config/backend.js";

export const CONTENT_TYPES = [
  { id: "json", label: "JSON", header: "application/json" },
  { id: "raw", label: "Raw", header: "" },
  { id: "form", label: "Form URL-Encoded", header: "application/x-www-form-urlencoded" },
  { id: "xml", label: "XML", header: "application/xml" },
  { id: "text", label: "Text/HTML", header: "text/plain" },
];

export const SLOW_MS = 2000;

// ─── Auto-backoff on 429 (sequential mode) ──────────────────
// No Retry-After header? Start short and double each consecutive 429
// on the SAME payload, up to a cap, instead of guessing one fixed wait.
export const BASE_429_MS = 2000;   // first fallback wait when no Retry-After
export const MAX_429_MS = 60000;   // cap for exponential backoff
export const MAX_429_RETRIES = 5;  // give up on a payload after this many 429s
