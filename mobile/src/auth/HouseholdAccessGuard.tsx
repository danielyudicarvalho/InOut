import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { View, Text, Pressable, AppState } from "react-native";
import { usePathname, useLocalSearchParams } from "expo-router";
import {
  createHouseholdAccessStore,
  createCollaborationRepository,
} from "@inout/finance/collaboration";
import { getAuthClient } from "./composition";
import { AccessRemoved } from "../screens/HouseholdManagementScreen";
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
    p = useLocalSearchParams(),
    id = typeof p.household === "string" ? p.household : "";
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
        baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
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
    const subscription = AppState.addEventListener("change", (value) => {
      if (value === "active") store.retry();
    });
    return () => {
      stop();
      subscription.remove();
    };
  }, [store]);
  if (state.status === "removed") return <AccessRemoved />;
  if (state.status !== "authorized")
    return (
      <View
        style={{
          flex: 1,
          padding: 24,
          backgroundColor: "#fbf6e8",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <Text>Verificando acesso à residência</Text>
        <Text accessibilityLiveRegion="polite">
          {state.notice || "Abrindo seu contexto autorizado…"}
        </Text>
        {state.status === "error" ? (
          <Pressable accessibilityRole="button" onPress={store.retry}>
            <Text>Tentar novamente</Text>
          </Pressable>
        ) : null}
      </View>
    );
  return children;
}
