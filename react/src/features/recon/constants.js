export { BACKEND } from "../../config/backend.js";

// ── Online wordlists ─────────────────────────────────────────
export const WORDLISTS = {
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
