"use client";
import { useEffect, useState } from "react";
import {
  createFinanceRepository,
  financeMessage,
  type FinancialAnalysis,
} from "@inout/finance";
import { browserApiBase, getAuthClient } from "../auth/composition";
export function useAnalysis(
  household: string,
  period: string,
  currency: string,
) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data: FinancialAnalysis | null;
    notice: string;
  }>({ key: "", data: null, notice: "" });
  const key = `${household}:${period}:${currency}:${revision}`;
  useEffect(() => {
    if (!household || !period || !currency) return;
    const controller = new AbortController();
    let disposed = false;
    const timer = setTimeout(() => {
      controller.abort();
      if (!disposed)
        setState({
          key,
          data: null,
          notice: "A consulta demorou mais que o esperado. Tente novamente.",
        });
    }, 20000);
    const repository = createFinanceRepository({
      baseUrl: browserApiBase(),
      getToken: async () => {
        const { data } = await getAuthClient().auth.getSession();
        return data.session?.access_token ?? null;
      },
    });
    repository
      .analysis(household, period, currency, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data, notice: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ key, data: null, notice: financeMessage(error) });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [household, period, currency, key]);
  return {
    data: state.key === key ? state.data : null,
    notice: state.key === key ? state.notice : "",
    retry: () => setRevision((v) => v + 1),
  };
}
