"use client";
import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plant, CircleNotch } from "@phosphor-icons/react";
import { useSessionRestoration } from "../lib/auth/use-session-restoration";
export type SessionState = "loading" | "expired" | "error";
const copy = {
  loading: {
    title: "Preparando seu Ninho...",
    description: "Estamos verificando seu acesso.",
  },
  expired: {
    title: "Entre novamente",
    description: "Sua sessão expirou. Entre para continuar.",
  },
  error: {
    title: "Não foi possível continuar",
    description:
      "Não conseguimos verificar seu acesso. Confira sua conexão e tente novamente.",
  },
};
export function SessionView({
  state,
  notice = "",
  onRetry,
}: {
  state: SessionState;
  notice?: string;
  onRetry?: () => void;
}) {
  const current = copy[state];
  return (
    <main className="session-screen">
      <Link href="/" className="brand">
        <Plant size={34} weight="duotone" aria-hidden="true" />
        ninho
      </Link>
      <Image
        className="session-art"
        src={`/images/pipo-session-${state}.webp`}
        alt={
          state === "loading"
            ? "Pipo sentado em seu ninho entre flores"
            : state === "expired"
              ? "Pipo ao lado de uma chave dourada"
              : "Pipo com um símbolo de conexão indisponível"
        }
        width={500}
        height={300}
        priority
      />
      {state === "loading" ? (
        <div className="session-state-icon" aria-hidden="true">
          <CircleNotch className="session-spinner" size={34} />
        </div>
      ) : null}
      <div role="status" aria-live="polite" aria-atomic="true">
        <h1>{current.title}</h1>
        <p className="session-description">{current.description}</p>
        {notice ? <p className="session-detail">{notice}</p> : null}
      </div>
      {state === "error" && onRetry ? (
        <button className="primary session-action" onClick={onRetry}>
          Tentar novamente
        </button>
      ) : null}
      {state !== "loading" ? (
        <Link
          className={
            state === "expired" ? "primary session-action" : "session-login"
          }
          href="/entrar"
        >
          Ir para entrar
        </Link>
      ) : null}
    </main>
  );
}
export function SessionScreen({
  initialState = "loading",
}: {
  initialState?: SessionState;
}) {
  const router = useRouter();
  return initialState === "loading" ? (
    <RestoringSessionScreen />
  ) : (
    <SessionView
      state={initialState}
      onRetry={() => router.replace("/preparando")}
    />
  );
}
function RestoringSessionScreen() {
  const { status, notice, retry } = useSessionRestoration();
  const router = useRouter();
  useEffect(() => {
    if (status === "authenticated") router.replace("/comecar");
    else if (status === "confirmationRequired")
      router.replace("/confirmar-email");
  }, [status, router]);
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
