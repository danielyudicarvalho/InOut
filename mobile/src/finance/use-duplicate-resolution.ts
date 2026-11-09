import { useEffect, useState, useSyncExternalStore } from "react";
import {
  createFinanceRepository,
  createDuplicateResolutionStore,
  FinanceFailure,
} from "@inout/finance";
import { getAuthClient } from "../auth/composition";

export function useDuplicateResolution(
  household: string,
  firstId: string,
  secondId: string = "",
) {
  const [store] = useState(() => {
    const repository = createFinanceRepository({
      baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
      getToken: async () => {
        const { data, error } = await getAuthClient().auth.getSession();
        if (error || !data.session) throw new FinanceFailure("unauthorized");
        return data.session.access_token;
      },
    });
    return createDuplicateResolutionStore(
      repository,
      household,
      firstId,
      secondId,
    );
  });

  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );

  useEffect(() => store.start(), [store]);

  return {
    ...state,
    select: store.select,
    retry: store.retry,
  };
}
