"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plant, Key, WifiSlash, CircleNotch } from "@phosphor-icons/react";

type SessionState = "loading" | "expired" | "error";
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
export function SessionScreen({
  initialState = "loading",
}: {
  initialState?: SessionState;
}) {
  const [state, setState] = useState(initialState);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    if (!retrying) return;
    const timer = setTimeout(() => {
      setState("error");
      setRetrying(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [retrying]);
  const current = copy[state];
  return (
    <main className="session-screen">
      <Link href="/" className="brand">
        <Plant size={34} weight="duotone" aria-hidden="true" />
        ninho
      </Link>
      <Image
        className="session-art"
        src="/images/pipo-home.webp"
        alt="Pipo em seu ninho entre plantas"
        width={320}
        height={235}
        priority
      />
      <div className="session-state-icon" aria-hidden="true">
        {state === "loading" ? (
          <CircleNotch className="session-spinner" size={38} />
        ) : state === "expired" ? (
          <Key size={38} />
        ) : (
          <WifiSlash size={38} />
        )}
      </div>
      <div role="status" aria-live="polite" aria-atomic="true">
        <h1>{current.title}</h1>
        <p className="session-description">{current.description}</p>
      </div>
      {state === "error" && (
        <button
          className="primary session-action"
          onClick={() => {
            setState("loading");
            setRetrying(true);
          }}
        >
          Tentar novamente
        </button>
      )}
      {state !== "loading" && (
        <Link
          className={
            state === "expired" ? "primary session-action" : "session-login"
          }
          href="/entrar"
        >
          Ir para entrar
        </Link>
      )}
      <p className="session-preview">
        Prévia de interface. A restauração de sessão ainda não está integrada.
        {retrying ? " Demonstrando uma nova tentativa." : ""}
      </p>
      <nav aria-label="Estados de demonstração" className="confirmation-demo">
        <Link href="/preparando">Carregando</Link>
        <Link href="/sessao-expirada">Sessão expirada</Link>
        <Link href="/falha-acesso">Falha ao restaurar</Link>
        <Link href="/entrar">Entrar</Link>
      </nav>
    </main>
  );
}
