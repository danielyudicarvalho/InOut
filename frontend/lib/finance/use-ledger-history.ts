"use client";
import { useEffect, useState } from "react";
import {
  createFinanceRepository,
  financeMessage,
  FinanceFailure,
  type HistoryItem,
  type HistoryFilters,
} from "@inout/finance";
import { getAuthClient } from "../auth/composition";
export function useLedgerHistory(
  household: string,
  period: string,
  filters: HistoryFilters,
  offset: number,
) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    items: HistoryItem[];
    hasMore: boolean;
    loading: boolean;
    error: string;
  }>({ items: [], hasMore: false, loading: true, error: "" });
  const {
    search,
    kind,
    accountId,
    transactionId,
    categoryId,
    incomeSourceId,
    includeSubcategories,
  } = filters;
  useEffect(() => {
    const controller = new AbortController();
    const repository = createFinanceRepository({
      baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
      getToken: async () => {
        const { data, error } = await getAuthClient().auth.getSession();
        if (error) throw new FinanceFailure("unauthorized");
        return data.session?.access_token ?? null;
      },
    });
    repository
      .ledgerHistory(
        household,
        period,
        {
          search,
          kind,
          accountId,
          transactionId,
          categoryId,
          incomeSourceId,
          includeSubcategories,
        },
        offset,
        controller.signal,
      )
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ ...data, loading: false, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            items: [],
            hasMore: false,
            loading: false,
            error: financeMessage(error),
          });
      });
    return () => controller.abort();
  }, [
    household,
    period,
    search,
    kind,
    accountId,
    transactionId,
    categoryId,
    incomeSourceId,
    includeSubcategories,
    offset,
    revision,
  ]);
  return { ...state, retry: () => setRevision((v) => v + 1) };
}
