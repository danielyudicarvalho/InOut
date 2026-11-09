import { useEffect, useState, useSyncExternalStore } from "react";
import {
  createFinanceRepository,
  createRecordFormTracker,
  createRecordStore,
  FinanceFailure,
  type RecordFields,
  type RecordKind,
} from "@inout/finance";
import { captureEvent, setHousehold } from "../analytics/posthog";
import { getAuthClient } from "../auth/composition";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
export function useRecord(
  household: string,
  kind: RecordKind,
  currency: string,
  preferredAccountId = "",
) {
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
    return createRecordStore(repository, household, kind, currency, {
      preferredAccountId,
      randomId: randomUUID,
      storage: {
        load: async () => {
          const { data, error } = await getAuthClient().auth.getUser();
          if (error || !data.user) throw new FinanceFailure("unauthorized");
          actorId = data.user.id;
          storageKey = `inout:pending-record:v1:${actorId}:${household}`;
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

  // Form timing for the Event Taxonomy (field names only, never values).
  const [tracker] = useState(() =>
    createRecordFormTracker({ kind, emit: captureEvent }),
  );
  useEffect(() => {
    if (state.status !== "ready") return;
    setHousehold(household);
    tracker.start();
  }, [state.status, household, tracker]);
  useEffect(() => () => tracker.close(), [tracker]);
  const edit = (field: keyof RecordFields, value: string) => {
    tracker.edit(field);
    store.edit(field, value);
  };
  const submit = () => {
    tracker.submit();
    return store.submit();
  };
  return {
    ...state,
    edit,
    submit,
    retry: store.retry,
  };
}
