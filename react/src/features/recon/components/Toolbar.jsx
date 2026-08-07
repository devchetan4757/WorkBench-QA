import { color, inputStyle } from "../../../theme/theme";
import { Button, OverflowMenu } from "../../../components/ui";
import { WORDLISTS } from "../constants";

export default function Toolbar({ rc }) {
  const {
    targetUrl, setTargetUrl, selectedWordlistKey, loadWordlist,
    loadingWordlist, wordlistError, wordlist, paths,
    followRedirects, setFollowRedirects, useExtensions, setUseExtensions,
    isRunning, progress, elapsed, stopRecon, runRecon,
  } = rc;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: `2px solid ${color.line}`, flexWrap: "wrap" }}>
      <input
        style={{ ...inputStyle, flex: "1 1 200px", minWidth: 140 }}
        value={targetUrl}
        onChange={(e) => setTargetUrl(e.target.value)}
        placeholder="https://.."
      />

      <select
        style={{ ...inputStyle, flex: "1 1 160px", minWidth: 120 }}
        value={selectedWordlistKey}
        onChange={(e) => loadWordlist(e.target.value)}
      >
        {Object.keys(WORDLISTS).map((k) => (
          <option key={k}>{k}</option>
        ))}
      </select>

      {loadingWordlist && <span style={{ fontSize: 11, color: color.red }}>Fetching…</span>}
      {wordlistError && <span style={{ fontSize: 11, color: color.red }}>{wordlistError}</span>}
      {!loadingWordlist && !wordlistError && wordlist && (
        <span style={{ fontSize: 10, color: color.faint }}>{paths.length} paths</span>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto" }}>
        {isRunning && (
          <span style={{ fontSize: 11, color: color.dim }}>
            <span style={{ color: color.red }}>{progress.done}</span>/{progress.total} · {elapsed}s
          </span>
        )}

        {/* Redirects / extensions are set-once-and-forget, not something
            you check every scan — tucked behind ⋮ instead of sitting open
            in the config pane, same as Burp keeps these under an options
            menu rather than a permanent row of checkboxes. */}
        <OverflowMenu
          accent={color.red}
          title="Scan options"
          items={[
            { label: "Follow redirects", selected: followRedirects, keepOpen: true, onClick: () => setFollowRedirects((v) => !v) },
            { label: "Append extensions", selected: useExtensions, keepOpen: true, onClick: () => setUseExtensions((v) => !v) },
          ]}
        />

        {isRunning ? (
          <Button variant="danger" onClick={stopRecon}>■ Stop</Button>
        ) : (
          <Button variant="solid" accent={color.red} disabled={loadingWordlist} onClick={runRecon} brackets>
            SCAN {paths.length}
          </Button>
        )}
      </div>
    </div>
  );
}
