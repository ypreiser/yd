import { useState, useEffect, useCallback, useRef } from "react";
import { checkConnectivity, type Connectivity } from "./tauri";

export type ConnectionState = "online" | "offline" | "no-youtube";

/** How often the backend probe runs while the app is in the foreground. */
const POLL_MS = 30_000;

/**
 * Connection state for the header indicator.
 *
 * `navigator.onLine` reacts instantly but only knows whether a network
 * interface is up, so it is used for the fast path (unplugged cable → offline
 * immediately) and the Rust probe decides everything else — including the case
 * where the machine is online but YouTube is not reachable.
 */
export function useConnectivity(pollMs: number = POLL_MS): ConnectionState {
  const [state, setState] = useState<ConnectionState>(() =>
    typeof navigator !== "undefined" && navigator.onLine === false
      ? "offline"
      : "online"
  );
  const cancelled = useRef(false);

  const probe = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setState("offline");
      return;
    }
    let result: Connectivity;
    try {
      result = await checkConnectivity();
    } catch {
      // A failing probe says nothing about the network — keep the last state.
      return;
    }
    if (cancelled.current) return;
    setState(
      result.youtube ? "online" : result.online ? "no-youtube" : "offline"
    );
  }, []);

  useEffect(() => {
    cancelled.current = false;
    probe();

    const timer = setInterval(probe, pollMs);
    const onOnline = () => probe();
    const onOffline = () => setState("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      cancelled.current = true;
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [probe, pollMs]);

  return state;
}
