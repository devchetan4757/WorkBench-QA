import { color } from "../../../theme/theme";
import { Button, OverflowMenu } from "../../../components/ui";

const MODE_LABEL = { sequential: "SEQ", parallel: "PAR", lastbyte: "LB" };

export default function ActionBar({ wb }) {
  const { clearHistory, sendMode, setSendMode, isSending, sendParallel, sendLastByte, sendAll, payloads } = wb;

  return (
    <div style={{
      position: "sticky", bottom: 0, left: 0, right: 0, zIndex: 60,
      borderTop: `2px solid ${color.line}`,
      background: "rgba(10,10,10,0.96)",
      padding: "10px 14px", display: "flex", gap: 10, alignItems: "center",
    }}>
      {/* Send mode is a rarely-changed setting, not something you need to
          look at every visit — it lives behind a picker menu, same way
          Burp tucks this kind of option behind a dropdown instead of a
          permanent row of buttons. Trigger label always shows the current
          mode so you're never guessing what's active. */}
      <OverflowMenu
        align="left"
        title="Send mode"
        trigger={`MODE: ${MODE_LABEL[sendMode]} ▾`}
        items={[
          { label: "Sequential", selected: sendMode === "sequential", onClick: () => setSendMode("sequential") },
          { label: "Parallel", selected: sendMode === "parallel", onClick: () => setSendMode("parallel") },
          { label: "Last-byte", selected: sendMode === "lastbyte", onClick: () => setSendMode("lastbyte") },
          { label: "Clear history", danger: true, onClick: clearHistory },
        ]}
      />
      <div style={{ flex: 1 }} />
      <Button
        variant="solid"
        disabled={isSending}
        onClick={sendMode === "parallel" ? sendParallel : sendMode === "lastbyte" ? sendLastByte : sendAll}
        style={{ padding: "12px 22px", fontSize: 12 }}
        brackets
      >
        {isSending ? "SENDING…" : `RUN · ${payloads.length}`}
      </Button>
    </div>
  );
}
