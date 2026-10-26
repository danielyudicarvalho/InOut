"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createSessionRestorer } from "@inout/identity/session";
import { AppState } from "react-native";
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
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void restorer.restore();
    });
    return () => {
      subscription.remove();
      stop();
    };
  }, [restorer]);
  return { ...snapshot, retry: restorer.restore };
}
