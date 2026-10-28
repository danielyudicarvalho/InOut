import { useEffect, useState, useSyncExternalStore } from "react";
import {
  createFinanceRepository,
  createAccountStore,
  FinanceFailure,
} from "@inout/finance";
import { getAuthClient } from "../auth/composition";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
export function useAccount(household: string, currency: string) {
  const [store] = useState(() => {
    let actorId = "",
      storageKey = "";
    const repository = createFinanceRepository({
      baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
      getToken: async () => {
        const { data, error } = await getAuthClient().auth.getSession();
        if (error || !data.session || data.session.user.id !== actorId)
          throw new FinanceFailure("unauthorized");
        return data.session.access_token;
      },
    });
    return createAccountStore(repository, household, currency, {
      randomId: randomUUID,
      storage: {
        load: async () => {
          const { data, error } = await getAuthClient().auth.getUser();
          if (error || !data.user) throw new FinanceFailure("unauthorized");
          actorId = data.user.id;
          storageKey = `inout:pending-account:v1:${actorId}:${household}`;
          return await AsyncStorage.getItem(storageKey);
        },
        save: async (value) => {
          const previous = await AsyncStorage.getItem(storageKey);
          if (previous && JSON.parse(previous).key !== JSON.parse(value).key)
            throw new FinanceFailure("pending");
          await AsyncStorage.setItem(storageKey, value);
        },
        remove: async (key) => {
          const previous = await AsyncStorage.getItem(storageKey);
          if (previous && JSON.parse(previous).key === key) {
            await AsyncStorage.removeItem(storageKey);
          }
        },
      },
    });
  });
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  useEffect(() => store.start(), [store]);
  return {
    ...state,
    edit: store.edit,
    submit: store.submit,
    retry: store.retry,
  };
}
