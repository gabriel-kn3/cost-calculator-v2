import { useEffect, useMemo, useRef, useState } from "react";
import { http } from "../../client/httpClient";

export default function useHealthStatus({ intervalMs = 90000 } = {}) {
  const [status, setStatus] = useState("unknown"); // unknown | ok | degraded | down | expired
  const [lastOkAt, setLastOkAt] = useState(null);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef(null);
  const inflightRef = useRef(false);

  const check = async () => {
    if (inflightRef.current) return;
    setBusy(true);
    inflightRef.current = true;

    try {
      // quick backend liveness
      await http.get("/health");
      // session validity (refreshes cookie too if you kept that behavior)
      await http.get("/auth/me");

      setStatus("ok");
      setLastOkAt(new Date());
    } catch (e) {
      const msg = String(e?.message || "");
      if (msg.includes("401")) setStatus("expired");
      else if (msg.includes("HTTP 5") || msg.includes("HTTP 4"))
        setStatus("degraded");
      else setStatus("down");
    } finally {
      inflightRef.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    check();
    timerRef.current = window.setInterval(check, intervalMs);
    return () => window.clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return useMemo(() => ({ status, lastOkAt, check, busy }), [status, lastOkAt]);
}
