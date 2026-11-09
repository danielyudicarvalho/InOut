"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createSessionRestorer } from "@inout/identity/session";
import { AppState } from "react-native";
import { identifyUser, resetUser } from "../analytics/posthog";
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
  const userId = snapshot.user?.id;
  useEffect(() => {
    if (userId) identifyUser(userId);
    else if (snapshot.status === "expired") resetUser();
  }, [userId, snapshot.status]);
  return { ...snapshot, retry: restorer.restore };
}
