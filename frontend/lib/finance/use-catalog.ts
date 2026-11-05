"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  createCatalogRepository,
  createCatalogStore,
} from "@inout/finance/catalog";
import { FinanceFailure } from "@inout/finance";
import { getAuthClient } from "../auth/composition";
export function useCatalog(household: string) {
  const [store] = useState(() => {
    let actor = "",
      storageKey = "";
    const repository = createCatalogRepository({
      baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
      getToken: async () => {
        const { data, error } = await getAuthClient().auth.getSession();
        if (error || !data.session || data.session.user.id !== actor)
          throw new FinanceFailure("unauthorized");
        return data.session.access_token;
      },
    });
    return createCatalogStore(repository, household, {
      randomId: () => window.crypto.randomUUID(),
      storage: {
        load: async () => {
          const { data, error } = await getAuthClient().auth.getUser();
          if (error || !data.user) throw new FinanceFailure("unauthorized");
          actor = data.user.id;
          storageKey = `inout:catalog:v1:${actor}:${household}`;
          return window.localStorage.getItem(storageKey);
        },
        save: async (value) => {
          const old = window.localStorage.getItem(storageKey);
          if (old && JSON.parse(old).key !== JSON.parse(value).key)
            throw new FinanceFailure("pending");
          window.localStorage.setItem(storageKey, value);
        },
        remove: async (key) => {
          const old = window.localStorage.getItem(storageKey);
          if (old && JSON.parse(old).key === key)
            window.localStorage.removeItem(storageKey);
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
    create: store.create,
    archive: store.archive,
    retry: store.retry,
    recover: store.recover,
  };
}
