import { useEffect, type ReactNode } from "react";
import { router, usePathname, useLocalSearchParams } from "expo-router";
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
  const pathname = usePathname();
  const params = useLocalSearchParams();

  const currentRoute = (() => {
    const searchEntries = Object.entries(params).filter(
      ([k, v]) => typeof v === "string" && k !== "next",
    ) as [string, string][];
    const qs = new URLSearchParams(searchEntries).toString();
    return qs ? `${pathname}?${qs}` : pathname;
  })();

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

  const handleLogin = () => {
    if (currentRoute && currentRoute !== "/" && currentRoute !== "/entrar") {
      router.replace({
        pathname: "/entrar",
        params: { next: currentRoute },
      });
    } else {
      router.replace("/entrar");
    }
  };

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
      onLogin={handleLogin}
      onRetry={() => void retry()}
    />
  );
}
