import { useEffect, useState, useSyncExternalStore } from "react";
import {
  createFinanceRepository,
  createIncomeDetailsStore,
  FinanceFailure,
} from "@inout/finance";
import { getAuthClient } from "../auth/composition";
export function useIncomeDetails(
  household: string,
  period: string,
  currency: string,
) {
  const [store] = useState(() =>
    createIncomeDetailsStore(
      createFinanceRepository({
        baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
        getToken: async () => {
          const { data, error } = await getAuthClient().auth.getSession();
          if (error) throw new FinanceFailure("unauthorized");
          return data.session?.access_token ?? null;
        },
      }),
      household,
      period,
      currency,
    ),
  );
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  useEffect(() => store.start(), [store]);
  return { ...state, retry: store.retry, loadMore: store.loadMore };
}
