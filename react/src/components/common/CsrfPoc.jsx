import { useState } from "react";
import { color } from "../../theme/theme";
import { Segmented, Button } from "../ui";
import ToolPanel from "../ui/ToolPanel";

// CsrfPoc.jsx — inline utility panel now (see ToolPanel.jsx). Same PoC
// generation logic as before, just expands in place instead of floating
// as a modal.
export default function CsrfPoc({ url, method, payloads, buildRequest, open, onToggle }) {
  const [pocType, setPocType] = useState("html");
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
    <ToolPanel icon="⇄" label="CSRF PoC" open={open} onToggle={onToggle}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Segmented
          size="sm"
          options={[{ value: "html", label: "HTML FORM" }, { value: "js", label: "JS FETCH" }]}
          value={pocType}
          onChange={setPocType}
          accent={color.tool}
        />

        <div style={{ fontSize: 10, color: color.dim, lineHeight: 1.5 }}>
          {pocType === "html"
            ? "Auto-submitting HTML form. Works without JS enabled. Best for simple POST/GET CSRF."
            : "Fetch-based POC. Sends with credentials included. Best for JSON or custom headers."}
        </div>

        <pre style={{
          background: "#000", borderRadius: 0, padding: 12,
          fontSize: 10, color: color.text, whiteSpace: "pre-wrap",
          wordBreak: "break-all", maxHeight: 200, overflowY: "auto", margin: 0,
          border: `2px solid ${color.toolDim}`,
        }}>
          {poc}
        </pre>

        <div style={{ display: "flex", gap: 6 }}>
          <Button onClick={copyPoc} style={{ flex: 1 }}>{copied ? "✓ COPIED" : "COPY"}</Button>
          <Button onClick={downloadPoc} style={{ flex: 1 }}>DOWNLOAD</Button>
          <Button onClick={openPoc} variant="solid" accent={color.tool} style={{ flex: 1 }}>
            TEST →
          </Button>
        </div>
      </div>
    </ToolPanel>
  );
}
