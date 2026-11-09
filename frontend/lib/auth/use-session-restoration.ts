"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createSessionRestorer } from "@inout/identity/session";
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
  const userId = snapshot.user?.id;
  useEffect(() => {
    if (userId) identifyUser(userId);
    else if (snapshot.status === "expired") resetUser();
  }, [userId, snapshot.status]);
  return { ...snapshot, retry: restorer.restore };
}
