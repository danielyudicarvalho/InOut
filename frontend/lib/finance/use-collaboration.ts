"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  createCollaborationRepository,
  createCollaborationStore,
} from "@inout/finance/collaboration";
import { getAuthClient } from "../auth/composition";
export function useCollaboration(household: string) {
  const [store] = useState(() =>
    createCollaborationStore(
      createCollaborationRepository({
        baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
        getToken: async () => {
          const { data, error } = await getAuthClient().auth.getSession();
          return error ? null : (data.session?.access_token ?? null);
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
  useEffect(() => store.start(), [store]);
  return {
    ...state,
    retry: store.retry,
    select: store.select,
    invite: store.invite,
    role: store.role,
    remove: store.remove,
    leave: store.leave,
    revoke: store.revoke,
    clearCode: store.clearCode,
  };
}
