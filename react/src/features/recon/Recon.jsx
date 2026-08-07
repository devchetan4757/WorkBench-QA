import { color, font } from "../../theme/theme";
import { Segmented } from "../../components/ui";
import { useReconScan } from "./hooks/useReconScan";
import Toolbar from "./components/Toolbar";
import ConfigPane from "./components/ConfigPane";
import ResultsPane from "./components/ResultsPane";
import InspectorPane from "./components/InspectorPane";

export default function Recon() {
  const rc = useReconScan();
  const { isRunning, pct, activePane, setActivePane, findings } = rc;

  return (
    <div style={{ fontFamily: font.body, color: color.text }}>
      {/* Progress bar — always visible while running, regardless of pane */}
      {isRunning && (
        <div style={{ height: 3, background: color.panel }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color.red, transition: "width 0.3s ease" }} />
        </div>
      )}

      <Toolbar rc={rc} />

      {/* Mobile pane tabs */}
      <div className="mobile-pane-tabs" style={{ padding: "10px 14px 0" }}>
        <Segmented
          accent={color.red}
          options={[
            { value: "config", label: "CONFIG" },
            { value: "results", label: `RESULTS (${findings.length})` },
            { value: "inspector", label: "INSPECT" },
          ]}
          value={activePane}
          onChange={setActivePane}
        />
      </div>

      {/* Main tri-pane console */}
      <div className="console-grid" style={{ padding: 14 }}>
        <ConfigPane rc={rc} active={activePane === "config"} />
        <ResultsPane rc={rc} active={activePane === "results"} />
        <InspectorPane rc={rc} active={activePane === "inspector"} />
      </div>
    </div>
  );
}
