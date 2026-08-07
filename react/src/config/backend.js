// In production, the React build is served by the same Flask app that
// exposes /api/*, so requests can just be relative (same origin) —
// no separate backend URL needed. For local dev (vite dev server on
// a different port than Flask), set VITE_API_URL in a local .env file.
export const BACKEND = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000" : "");
