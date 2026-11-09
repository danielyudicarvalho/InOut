"use client";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  createAccountsRepository,
  type ManagedAccount,
} from "@inout/finance/accounts";
import { financeMessage } from "@inout/finance";
import { browserApiBase, getAuthClient } from "../auth/composition";
export function useAccounts(household: string) {
  const repository = useMemo(
    () =>
      createAccountsRepository({
        baseUrl: browserApiBase(),
        getToken: async () => {
          const { data } = await getAuthClient().auth.getSession();
          return data.session?.access_token ?? null;
        },
      }),
    [],
  );
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0);
  const current = useRef(household);
  useEffect(() => {
    current.current = household;
    return () => {
      current.current = "";
    };
  }, [household]);
  const lock = useRef(false);
  const reload = useCallback(() => {
    setLoading(true);
    setRevision((v) => v + 1);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (!household) return () => controller.abort();
    repository
      .list(household, controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) {
          setAccounts(rows);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(financeMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [household, repository, revision]);
  async function mutate(action: () => Promise<void>) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setNotice("");
    const scope = household;
    try {
      await action();
      if (current.current === scope) {
        setNotice("Conta atualizada.");
        reload();
      }
      return true;
    } catch (e) {
      if (current.current === scope)
        setNotice(
          `Não foi possível confirmar a alteração. Atualize as contas antes de tentar novamente. ${financeMessage(e)}`,
        );
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    accounts,
    error,
    loading,
    busy,
    notice,
    reload,
    edit: (id: string, name: string, kind: string) =>
      mutate(() => repository.edit(household, id, name, kind)),
    archive: (id: string) => mutate(() => repository.archive(household, id)),
  };
}
