// Reads the backend URL from the Vite env at build time.
// Set VITE_API_URL in Netlify/Vercel project settings for production,
// and optionally in a local .env file for dev (falls back to localhost:5000).
export const BACKEND = import.meta.env.VITE_API_URL || "http://localhost:5000";
