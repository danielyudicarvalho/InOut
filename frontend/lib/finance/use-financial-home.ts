"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  createFinanceRepository,
  createFinancialHomeStore,
  FinanceFailure,
} from "@inout/finance";
import { getAuthClient } from "../auth/composition";
export function useFinancialHome(
  options: { initialHouseholdId?: string; initialPeriod?: string } = {},
) {
  const [store] = useState(() =>
    createFinancialHomeStore(
      createFinanceRepository({
        baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
        getToken: async () => {
          const { data, error } = await getAuthClient().auth.getSession();
          if (error) throw new FinanceFailure("unauthorized");
          return data.session?.access_token ?? null;
        },
      }),
      options,
    ),
  );
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  useEffect(() => store.start(), [store]);
  return {
    ...state,
    retry: store.retry,
    selectHousehold: store.selectHousehold,
    selectPeriod: store.selectPeriod,
  };
}
