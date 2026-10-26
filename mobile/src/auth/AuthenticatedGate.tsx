import { useEffect, type ReactNode } from "react";
import { router } from "expo-router";
import { useSessionRestoration } from "./use-session-restoration";
import { SessionView } from "../screens/SessionScreen";
export function AuthenticatedGate({
  children,
  allowAnonymous = false,
}: {
  children: ReactNode;
  allowAnonymous?: boolean;
}) {
  const { status, notice, retry } = useSessionRestoration();
  useEffect(() => {
    if (status === "confirmationRequired") router.replace("/confirmar-email");
    else if (allowAnonymous && status === "authenticated")
      router.replace("/comecar");
  }, [status, allowAnonymous]);
  if (
    (!allowAnonymous && status === "authenticated") ||
    (allowAnonymous && status === "expired")
  )
    return <>{children}</>;
  return (
    <SessionView
      state={
        status === "expired"
          ? "expired"
          : status === "error"
            ? "error"
            : "loading"
      }
      notice={notice}
      onRetry={() => void retry()}
    />
  );
}
