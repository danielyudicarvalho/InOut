"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSessionRestoration } from "../../lib/auth/use-session-restoration";
import { SessionView } from "../screens/session-screen";
export function AuthenticatedGate({
  children,
  allowAnonymous = false,
}: {
  children: ReactNode;
  allowAnonymous?: boolean;
}) {
  const { status, notice, retry } = useSessionRestoration();
  const router = useRouter();
  useEffect(() => {
    if (status === "confirmationRequired") router.replace("/confirmar-email");
    else if (allowAnonymous && status === "authenticated")
      router.replace("/comecar");
  }, [status, allowAnonymous, router]);
  if (
    (!allowAnonymous && status === "authenticated") ||
    (allowAnonymous && status === "expired")
  )
    return <>{children}</>;
  const currentPath =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "";
  const loginHref =
    currentPath && currentPath !== "/" && currentPath !== "/entrar"
      ? `/entrar?next=${encodeURIComponent(currentPath)}`
      : "/entrar";

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
      loginHref={loginHref}
      onRetry={() => void retry()}
    />
  );
}
