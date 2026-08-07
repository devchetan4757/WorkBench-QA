import { color, inputStyle } from "../../../theme/theme";
import { Panel, Field, Section, Segmented, Button } from "../../../components/ui";
import { CONTENT_TYPES } from "../constants";

export default function RequestPane({ wb, active }) {
  const {
    url, setUrl, method, setMethod, payloadMode, setPayloadMode,
    singlePayload, setSinglePayload, rangeStart, setRangeStart, rangeEnd, setRangeEnd,
    charFrom, setCharFrom, charTo, setCharTo, manualList, setManualList,
    dictUrl, setDictUrl, dictFetchStatus, dictFetchError, dictFetchMeta, fetchDictionary,
    delayMs, setDelayMs, headersText, setHeadersText, cookie, setCookie,
    queryParams, setQueryParams, contentType, setContentType, bodyTemplate, setBodyTemplate,
    payloads, previewFor,
  } = wb;

  const hasBody = method !== "GET";

  return (
    <div className={`pane ${active ? "is-active" : ""}`}>
      <Panel framed accent={color.amber}>
        <Field label="Target URL — {{payload}} works here">
          <input style={inputStyle} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://target.com/user/{{payload}}" />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Field label="Method">
            <select style={inputStyle} value={method} onChange={(e) => setMethod(e.target.value)}>
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Payload Mode">
            <select style={inputStyle} value={payloadMode} onChange={(e) => setPayloadMode(e.target.value)}>
              <option value="single">Single</option>
              <option value="numeric">Numeric</option>
              <option value="charset">Charset</option>
              <option value="manual">Manual</option>
              <option value="url">URL / Dictionary File</option>
            </select>
          </Field>
        </div>

        {/* ── Sections below: only the fields relevant to the current option render.
            BODY doesn't even mount for GET — nothing to scroll past for a request
            type that can't carry one. ── */}
        <div style={{ marginTop: 4 }}>
          <Section title="PAYLOAD VALUE" badge={payloadMode} defaultOpen accent={color.amber}>
            {payloadMode === "single" && (
              <Field label="Payload">
                <input style={inputStyle} value={singlePayload} onChange={(e) => setSinglePayload(e.target.value)} />
              </Field>
            )}
            {payloadMode === "numeric" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Field label="From"><input type="number" style={inputStyle} value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} /></Field>
                <Field label="To"><input type="number" style={inputStyle} value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} /></Field>
              </div>
            )}
            {payloadMode === "charset" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Field label="From"><input style={inputStyle} value={charFrom} maxLength={1} onChange={(e) => setCharFrom(e.target.value)} placeholder="a" /></Field>
                <Field label="To"><input style={inputStyle} value={charTo} maxLength={1} onChange={(e) => setCharTo(e.target.value)} placeholder="z" /></Field>
              </div>
            )}
            {payloadMode === "manual" && (
              <Field label="Payloads (one per line)">
                <textarea style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} value={manualList} onChange={(e) => setManualList(e.target.value)} />
              </Field>
            )}
            {payloadMode === "url" && (
              <Field label="Dictionary / Wordlist URL — one payload per line">
                <div style={{ display: "flex", gap: 6 }}>
                  <input style={inputStyle} value={dictUrl} onChange={(e) => setDictUrl(e.target.value)} placeholder="https://example.com/wordlist.txt" />
                  <Button variant="solid" accent={color.amber} disabled={dictFetchStatus === "loading"} onClick={fetchDictionary}>
                    {dictFetchStatus === "loading" ? "…" : "Fetch"}
                  </Button>
                </div>
                <div style={{ marginTop: 6, fontSize: 10 }}>
                  {dictFetchStatus === "done" && dictFetchMeta && (
                    <span style={{ color: color.green }}>
                      Loaded {dictFetchMeta.count} payload{dictFetchMeta.count !== 1 ? "s" : ""}
                      {dictFetchMeta.truncated ? " (truncated to size limit)" : ""}
                    </span>
                  )}
                  {dictFetchStatus === "error" && <span style={{ color: color.danger }}>Failed: {dictFetchError}</span>}
                  {dictFetchStatus === "idle" && <span style={{ color: color.faint }}>Fetched server-side to avoid CORS issues.</span>}
                </div>
              </Field>
            )}
            <Field label="Delay between requests (ms) — sequential mode only, helps avoid 429s" style={{ marginBottom: 0, marginTop: 10 }}>
              <input
                type="number" min="0" step="100" style={inputStyle}
                value={delayMs}
                onChange={(e) => setDelayMs(Math.max(0, Number(e.target.value) || 0))}
                placeholder="0"
              />
            </Field>
          </Section>

          <Section title="HEADERS" accent={color.amber}>
            <Field label="Headers — {{payload}} works here" style={{ marginBottom: 0 }}>
              <textarea style={{ ...inputStyle, minHeight: 88, resize: "vertical" }} value={headersText} onChange={(e) => setHeadersText(e.target.value)} />
            </Field>
          </Section>

          <Section title="COOKIE" accent={color.amber}>
            <Field label="Cookie — {{payload}} works here" style={{ marginBottom: 0 }}>
              <textarea style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} value={cookie} onChange={(e) => setCookie(e.target.value)} placeholder="session=abc; TrackingId={{payload}}" />
            </Field>
          </Section>

          <Section title="QUERY PARAMS" accent={color.amber}>
            <Field label={<>Query Params — <span style={{ color: color.amber }}>{"{{payload}}"}</span> works here</>} style={{ marginBottom: 0 }}>
              <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} value={queryParams} onChange={(e) => setQueryParams(e.target.value)} placeholder="foo=bar&trackingId={{payload}}" />
            </Field>
          </Section>

          {/* GET can't carry a body — section is gone entirely, not just
              greyed out, so there's nothing to open, scroll, or wonder about. */}
          {hasBody && (
            <Section title="BODY" badge={contentType} accent={color.amber}>
              <Field label="Body Content-Type">
                <Segmented size="sm" options={CONTENT_TYPES.map((c) => ({ value: c.id, label: c.label }))} value={contentType} onChange={setContentType} />
              </Field>
              <Field label={<>Body — <span style={{ color: color.amber }}>{"{{payload}}"}</span> works here</>} style={{ marginBottom: 0 }}>
                <textarea
                  style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
                  value={bodyTemplate}
                  onChange={(e) => setBodyTemplate(e.target.value)}
                />
              </Field>
            </Section>
          )}

          <Section title="LIVE PREVIEW" accent={color.amber}>
            <div style={{ background: "#000", borderRadius: 0, padding: 12, fontSize: 10.5, color: color.dim, whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: 1.6, border: `1px solid ${color.line}` }}>
              {previewFor(payloads[0] ?? "")}
            </div>
          </Section>
        </div>
      </Panel>
    </div>
  );
}
