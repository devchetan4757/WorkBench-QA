import { useEffect, useState } from "react";

const STORAGE_KEY = "qa-match-replace-rules";

function loadRules() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// useMatchReplace.js — rule list for the Match & Replace feature. Rules
// persist across reloads (localStorage) so a token/header swap you set up
// once keeps applying every session, same as Burp's Proxy > Match and
// Replace tab.
export function useMatchReplace() {
  const [rules, setRules] = useState(loadRules);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  }, [rules]);

  function addRule(partial = {}) {
    setRules((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        enabled: true,
        scope: "headers",
        find: "",
        replace: "",
        isRegex: false,
        ...partial,
      },
    ]);
  }

  function updateRule(id, patch) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRule(id) {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  function toggleRule(id) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  }

  return { rules, addRule, updateRule, removeRule, toggleRule };
}
