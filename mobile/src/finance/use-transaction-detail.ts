import { useEffect, useState, useSyncExternalStore } from "react";
import {
  createFinanceRepository,
  createTransactionDetailStore,
  FinanceFailure,
} from "@inout/finance";
import { getAuthClient } from "../auth/composition";
export function useTransactionDetail(household: string, transactionId: string) {
  const [store] = useState(() =>
    createTransactionDetailStore(
      createFinanceRepository({
        baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
        getToken: async () => {
          const { data, error } = await getAuthClient().auth.getSession();
          if (error || !data.session) throw new FinanceFailure("unauthorized");
          return data.session.access_token;
        },
      }),
      household,
      transactionId,
    ),
  );
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  useEffect(() => store.start(), [store]);
  return { ...state, reload: store.reload };
}
