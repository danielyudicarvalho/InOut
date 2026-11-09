import { useEffect, useState } from "react";
import {
  createFinanceRepository,
  financeMessage,
  type IncomePage,
} from "@inout/finance";
import { getAuthClient } from "../auth/composition";
export function useSourceShare(
  household: string,
  period: string,
  currency: string,
) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    status: "loading" | "ready" | "error";
    data: IncomePage | null;
    notice: string;
  }>({ status: "loading", data: null, notice: "" });
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      if (!disposed)
        setState({
          status: "error",
          data: null,
          notice: "A consulta demorou mais que o esperado. Tente novamente.",
        });
    }, 15000);
    const repository = createFinanceRepository({
      baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
      getToken: async () => {
        const { data } = await getAuthClient().auth.getSession();
        return data.session?.access_token ?? null;
      },
    });
    repository
      .income(household, period, currency, 0, controller.signal, true)
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ status: "ready", data, notice: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            status: "error",
            data: null,
            notice: financeMessage(error),
          });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [household, period, currency, revision]);
  return { ...state, retry: () => setRevision((v) => v + 1) };
}
