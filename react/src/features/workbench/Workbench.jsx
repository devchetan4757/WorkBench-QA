import { Segmented } from "../../components/ui";
import { useWorkbench } from "./hooks/useWorkbench";
import RequestPane from "./components/RequestPane";
import HistoryPane from "./components/HistoryPane";
import InspectorPane from "./components/InspectorPane";
import ActionBar from "./components/ActionBar";

export default function Workbench() {
  const wb = useWorkbench();
  const { activePane, setActivePane, history } = wb;

  return (
    <>
      {/* ── MOBILE PANE TABS — general controls stay reachable from any pane ── */}
      <div className="mobile-pane-tabs" style={{ padding: "10px 14px 0" }}>
        <Segmented
          options={[
            { value: "request", label: "REQUEST" },
            { value: "history", label: `HISTORY (${history.length})` },
            { value: "response", label: "RESPONSE" },
          ]}
          value={activePane}
          onChange={setActivePane}
        />
      </div>

      <div className="console-grid" style={{ padding: "10px 14px 14px", maxWidth: 1380, margin: "0 auto" }}>
        <RequestPane wb={wb} active={activePane === "request"} />
        <HistoryPane wb={wb} active={activePane === "history"} />
        <InspectorPane wb={wb} active={activePane === "response"} />
      </div>

      <ActionBar wb={wb} />
    </>
  );
}
