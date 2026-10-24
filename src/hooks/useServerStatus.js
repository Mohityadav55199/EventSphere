import { useEffect, useState } from "react";
import { baseURL } from "../config/baseURL.js";

// Reports whether the API is reachable and its database is connected.
//   "checking"    first request still in flight (Render may be waking up)
//   "ready"       server up and MongoDB connected
//   "db-down"     server up but MongoDB is not connected: logins/bookings will fail
//   "unreachable" no response (server asleep or down)
// Keeps polling every few seconds until the status becomes "ready".
export default function useServerStatus(pollMs = 5000) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;
    let timer;

    const check = async () => {
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), 15000);
      let next;
      try {
        const res = await fetch(`${baseURL}/health`, { signal: controller.signal });
        const body = await res.json();
        next = body.database === "connected" ? "ready" : "db-down";
      } catch {
        next = "unreachable";
      } finally {
        clearTimeout(abortTimer);
      }
      if (cancelled) return;
      setStatus(next);
      if (next !== "ready") timer = setTimeout(check, pollMs);
    };

    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pollMs]);

  return status;
}
