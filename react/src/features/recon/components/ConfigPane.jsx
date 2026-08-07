import { color, font, inputStyle } from "../../../theme/theme";
import { Panel, Field, Section, Eyebrow, Button } from "../../../components/ui";

export default function ConfigPane({ rc, active }) {
  const {
    selectedWordlistKey, wordlist, setWordlist,
    threads, setThreads, filterCodes, setFilterCodes,
    useExtensions, setUseExtensions,
    extensions, setExtensions, customHeaders, setCustomHeaders,
    customWordlistUrl, setCustomWordlistUrl, customFetchStatus, customFetchError, customFetchMeta, fetchCustomWordlist,
    paths,
  } = rc;

  return (
    <div className={`pane ${active ? "is-active" : ""}`} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {selectedWordlistKey === "Custom (type below)" && (
        <Panel framed accent={color.red}>
          <Eyebrow accent={color.red}>CUSTOM WORDLIST</Eyebrow>

          <Field label="Fetch from URL — one payload per line" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                style={inputStyle}
                value={customWordlistUrl}
                onChange={(e) => setCustomWordlistUrl(e.target.value)}
                placeholder="https://example.com/wordlist.txt"
              />
              <Button
                variant="solid"
                accent={color.red}
                disabled={customFetchStatus === "loading" || !customWordlistUrl.trim()}
                onClick={fetchCustomWordlist}
              >
                {customFetchStatus === "loading" ? "…" : "Fetch"}
              </Button>
            </div>
            <div style={{ marginTop: 6, fontSize: 14, fontFamily: font.body }}>
              {customFetchStatus === "done" && customFetchMeta && (
                <span style={{ color: color.green }}>
                  Loaded {customFetchMeta.count} path{customFetchMeta.count !== 1 ? "s" : ""}
                </span>
              )}
              {customFetchStatus === "error" && <span style={{ color: color.danger }}>{customFetchError}</span>}
              {customFetchStatus === "idle" && <span style={{ color: color.faint }}>Fetched server-side to avoid CORS issues.</span>}
            </div>
          </Field>

          <textarea
            style={{ ...inputStyle, minHeight: 160, resize: "vertical" }}
            value={wordlist}
            onChange={(e) => setWordlist(e.target.value)}
            placeholder={"admin\nlogin\napi/v1\n.env"}
          />
          <div style={{ fontSize: 10, color: color.faint, marginTop: 6 }}>
            {wordlist.split("\n").filter(Boolean).length} lines
          </div>
        </Panel>
      )}

      <Panel style={{ padding: "4px 14px" }}>
        <Section title="SCAN OPTIONS" accent={color.red} defaultOpen>
          <Field label="Threads (concurrent)">
            <input type="number" style={inputStyle} value={threads} min={1} max={100} onChange={(e) => setThreads(Number(e.target.value))} />
          </Field>

          <Field label="Filter status codes (hide)">
            <input style={inputStyle} value={filterCodes} onChange={(e) => setFilterCodes(e.target.value)} placeholder="404,400" />
          </Field>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: useExtensions ? 10 : 0 }}>
            <span style={{ fontSize: 11, color: color.faint }}>
              Redirects and extensions live in the <span style={{ color: color.red }}>⋮</span> menu above.
            </span>
          </div>

          {useExtensions && (
            <Field label="Extensions (comma-separated)" style={{ marginBottom: 0 }}>
              <input style={inputStyle} value={extensions} onChange={(e) => setExtensions(e.target.value)} placeholder="php,html,txt,bak" />
            </Field>
          )}
        </Section>

        <Section title="HEADERS" accent={color.red}>
          <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={customHeaders} onChange={(e) => setCustomHeaders(e.target.value)} />
        </Section>
      </Panel>

      <Panel style={{ background: color.redDim, border: `2px solid ${color.red}` }}>
        <Eyebrow accent={color.red}>SUMMARY</Eyebrow>
        {[
          ["Wordlist", selectedWordlistKey.split(" (")[0]],
          ["Paths", paths.length],
          ["Threads", threads],
          ["Est. batches", Math.ceil(paths.length / threads) || 0],
          ["Filter codes", filterCodes || "none"],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
            <span style={{ color: color.faint }}>{k}</span>
            <span style={{ color: color.text, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>{v}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}
