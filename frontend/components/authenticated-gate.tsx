"use client";
import { useEffect, Suspense, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSessionRestoration } from "../lib/auth/use-session-restoration";
import { HouseholdAccessGuard } from "./household-access-guard";
import { SessionView } from "./session-screen";
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
    return allowAnonymous ? (
      <>{children}</>
    ) : (
      <Suspense fallback={<p>Verificando acesso…</p>}>
        <HouseholdAccessGuard>{children}</HouseholdAccessGuard>
      </Suspense>
    );
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
