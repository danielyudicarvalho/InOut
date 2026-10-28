"use client";
import { useEffect, useState } from "react";
import {
  createFinanceRepository,
  financeMessage,
  FinanceFailure,
  type HistoryOptions,
} from "@inout/finance";
import { getAuthClient } from "../auth/composition";
export function useHistoryOptions(household: string) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    data: HistoryOptions | null;
    error: string;
  }>({ data: null, error: "" });
  useEffect(() => {
    const c = new AbortController();
    const repo = createFinanceRepository({
      baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
      getToken: async () => {
        const { data, error } = await getAuthClient().auth.getSession();
        if (error) throw new FinanceFailure("unauthorized");
        return data.session?.access_token ?? null;
      },
    });
    repo
      .historyOptions(household, c.signal)
      .then((data) => {
        if (!c.signal.aborted) setState({ data, error: "" });
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setState({ data: null, error: financeMessage(e) });
      });
    return () => c.abort();
  }, [household, revision]);
  return { ...state, retry: () => setRevision((v) => v + 1) };
}
