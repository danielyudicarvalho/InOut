"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  createFinanceRepository,
  createRecordStore,
  FinanceFailure,
  type RecordKind,
} from "@inout/finance";
import { browserApiBase, getAuthClient } from "../auth/composition";
export function useRecord(
  household: string,
  kind: RecordKind,
  currency: string,
  preferredAccountId = "",
) {
  const [bundle] = useState(() => {
    let actorId = "",
      storageKey = "";
    const repository = createFinanceRepository({
      baseUrl: browserApiBase(),
      getToken: async () => {
        const { data, error } = await getAuthClient().auth.getSession();
        if (error || !data.session || data.session.user.id !== actorId)
          throw new FinanceFailure("unauthorized");
        return data.session.access_token;
      },
    });
    const store = createRecordStore(repository, household, kind, currency, {
      preferredAccountId,
      randomId: () => window.crypto.randomUUID(),
      storage: {
        load: async () => {
          const { data, error } = await getAuthClient().auth.getUser();
          if (error || !data.user) throw new FinanceFailure("unauthorized");
          actorId = data.user.id;
          storageKey = `inout:pending-record:v1:${actorId}:${household}`;
          return window.localStorage.getItem(storageKey);
        },
        save: async (value) => {
          const previous = window.localStorage.getItem(storageKey);
          if (previous && JSON.parse(previous).key !== JSON.parse(value).key)
            throw new FinanceFailure("pending");
          window.localStorage.setItem(storageKey, value);
        },
        remove: async (key) => {
          const previous = window.localStorage.getItem(storageKey);
          if (previous && JSON.parse(previous).key === key) {
            window.localStorage.removeItem(storageKey);
          }
        },
      },
    });
    return { repository, store };
  });
  const state = useSyncExternalStore(
    bundle.store.subscribe,
    bundle.store.getSnapshot,
    bundle.store.getSnapshot,
  );
  useEffect(() => bundle.store.start(), [bundle.store]);

  const createCategory = async (
    name: string,
    flow: "income" | "expense",
    parentId?: string | null,
  ) => {
    const key = window.crypto.randomUUID();
    const result = await bundle.repository.createCategory(
      household,
      { name, flow, parentId },
      key,
    );
    bundle.store.retry();
    return result;
  };

  const createIncomeSource = async (name: string) => {
    const id = window.crypto.randomUUID();
    const result = await bundle.repository.createIncomeSource(
      household,
      { name },
      id,
    );
    bundle.store.retry();
    return result;
  };

  return {
    ...state,
    edit: bundle.store.edit,
    submit: bundle.store.submit,
    retry: bundle.store.retry,
    createCategory,
    createIncomeSource,
  };
}
