"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createSessionRestorer } from "@inout/identity/session";
import { getAuth } from "./composition";
export function useSessionRestoration() {
  const [restorer] = useState(() => createSessionRestorer(getAuth));
  const snapshot = useSyncExternalStore(
    restorer.subscribe,
    restorer.getSnapshot,
    restorer.getSnapshot,
  );
  useEffect(() => {
    const stop = restorer.start();
    const validate = () => {
      if (document.visibilityState === "visible") void restorer.restore();
    };
    window.addEventListener("focus", validate);
    window.addEventListener("online", validate);
    document.addEventListener("visibilitychange", validate);
    return () => {
      window.removeEventListener("focus", validate);
      window.removeEventListener("online", validate);
      document.removeEventListener("visibilitychange", validate);
      stop();
    };
  }, [restorer]);
  return { ...snapshot, retry: restorer.restore };
}
