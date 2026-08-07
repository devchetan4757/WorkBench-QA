import { color } from "../../../theme/theme";

export function statusBg(s) {
  if (!s || s === "ERR") return color.redDim;
  if (s >= 200 && s < 300) return "rgba(57,255,106,0.06)";
  if (s >= 300 && s < 400) return "rgba(94,177,255,0.06)";
  if (s === 401 || s === 403) return color.amberDim;
  return "transparent";
}

export function buildPaths(wordlist, useExtensions, extensions) {
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

export function parseFilterCodes(filterCodes) {
  return filterCodes
    .split(",")
    .map((c) => parseInt(c.trim(), 10))
    .filter(Number.isFinite);
}

export function parseHeadersText(text) {
  const h = {};
  text.split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx > -1) {
      h[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  });
  return h;
}
