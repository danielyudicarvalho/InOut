import { useEffect, useState } from "react";
import {
  createFinanceRepository,
  FinanceFailure,
  financeMessage,
  type CategorySummary,
} from "@inout/finance";
import { getAuthClient } from "../auth/composition";
export function useCategorySummary(
  household: string,
  period: string,
  currency: string,
) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    data: CategorySummary | null;
    error: string;
    loading: boolean;
  }>({ data: null, error: "", loading: true });
  useEffect(() => {
    const abort = new AbortController();
    let active = true;
    const repository = createFinanceRepository({
      baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
      getToken: async () => {
        const { data, error } = await getAuthClient().auth.getSession();
        if (error) throw new FinanceFailure("unauthorized");
        return data.session?.access_token ?? null;
      },
    });
    repository
      .categorySummary(household, period, currency, abort.signal)
      .then((data) => {
        if (active) setState({ data, error: "", loading: false });
      })
      .catch((error) => {
        if (active)
          setState({
            data: null,
            error: financeMessage(error),
            loading: false,
          });
      });
    return () => {
      active = false;
      abort.abort();
    };
  }, [household, period, currency, revision]);
  return {
    ...state,
    retry: () => {
      setState({ data: null, error: "", loading: true });
      setRevision((value) => value + 1);
    },
  };
}
