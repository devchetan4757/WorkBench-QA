import { useState, useEffect } from "react";
import { color } from "../../../theme/theme";

export default function BackoffBanner({ notice }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, notice.untilTs - now);
  const remainingS = (remainingMs / 1000).toFixed(1);

  return (
    <div style={{
      background: color.amberDim, border: `2px solid ${color.amber}`,
      borderRadius: 0, padding: "8px 10px", marginBottom: 10, fontSize: 11, color: color.amber,
    }}>
      ⚠ 429 rate limited — waiting {remainingS}s ({notice.source}) before next request
    </div>
  );
}
