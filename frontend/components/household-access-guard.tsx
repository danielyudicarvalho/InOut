"use client";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  createHouseholdAccessStore,
  createCollaborationRepository,
} from "@inout/finance/collaboration";
import { getAuthClient } from "../lib/auth/composition";
import { AccessRemoved } from "./household-management-screen";
const paths = new Set([
  "/inicio",
  "/contas",
  "/categorias",
  "/gerenciar-fontes",
  "/composicao-saldo",
  "/lancamentos",
  "/lancamento",
  "/novo-registro",
  "/configuracao-inicial",
  "/receitas",
  "/despesas",
  "/resultado",
  "/resumo-categorias",
  "/fontes-renda",
]);
export function HouseholdAccessGuard({ children }: { children: ReactNode }) {
  const path = usePathname(),
    p = useSearchParams(),
    id = p.get("household") ?? "";
  return paths.has(path) ||
    path === "/analises" ||
    path.startsWith("/analises/") ? (
    <LiveGuard key={`${path}:${id}`} household={id}>
      {children}
    </LiveGuard>
  ) : (
    children
  );
}
function LiveGuard({
  household,
  children,
}: {
  household: string;
  children: ReactNode;
}) {
  const [store] = useState(() =>
    createHouseholdAccessStore(
      createCollaborationRepository({
        baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
        getToken: async () => {
          const { data } = await getAuthClient().auth.getSession();
          return data.session?.access_token ?? null;
        },
      }),
      household,
    ),
  );
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  useEffect(() => {
    const stop = store.start();
    const focus = () => store.retry();
    window.addEventListener("focus", focus);
    return () => {
      stop();
      window.removeEventListener("focus", focus);
    };
  }, [store]);
  if (state.status === "removed") return <AccessRemoved />;
  if (state.status !== "authorized")
    return (
      <main className="financial-state">
        <h1>Verificando acesso à residência</h1>
        <p role="status">
          {state.notice || "Abrindo seu contexto autorizado…"}
        </p>
        {state.status === "error" ? (
          <button onClick={store.retry}>Tentar novamente</button>
        ) : null}
      </main>
    );
  return children;
}
