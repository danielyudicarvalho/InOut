import { useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createFinanceRepository,
  FinanceFailure,
  financeMessage,
  type RecordKind,
  type HistoryItem,
} from "@inout/finance";
import { getAuthClient } from "../auth/composition";

export interface PendingRecordData {
  kind: RecordKind;
  description: string;
  amount: number;
  currency: string;
  accountName: string;
  date: string;
  period: string;
  hasStoredPending: boolean;
}

export function usePendingVerification({
  householdId,
  initialKind = "expense",
  initialCurrency = "BRL",
  initialDescription = "",
  initialAmount = 0,
  initialDate = "",
  initialAccount = "",
}: {
  householdId: string;
  initialKind?: RecordKind;
  initialCurrency?: string;
  initialDescription?: string;
  initialAmount?: number;
  initialDate?: string;
  initialAccount?: string;
}) {
  const [data, setData] = useState<PendingRecordData>({
    kind: initialKind,
    description: initialDescription,
    amount: initialAmount,
    currency: initialCurrency,
    accountName: initialAccount,
    date: initialDate || new Date().toISOString().slice(0, 10),
    period: (initialDate || new Date().toISOString().slice(0, 10)).slice(0, 7),
    hasStoredPending: false,
  });

  const [status, setStatus] = useState<
    "idle" | "verifying" | "confirmed" | "uncertain" | "error"
  >("idle");
  const [confirmedTransaction, setConfirmedTransaction] = useState<
    string | null
  >(null);
  const [notice, setNotice] = useState<string>("");

  const repository = createFinanceRepository({
    baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    getToken: async () => {
      const { data: sessionData, error } =
        await getAuthClient().auth.getSession();
      if (error || !sessionData.session)
        throw new FinanceFailure("unauthorized");
      return sessionData.session.access_token;
    },
  });

  useEffect(() => {
    let active = true;

    async function loadPending() {
      try {
        const { data: userData, error } = await getAuthClient().auth.getUser();
        if (error || !userData.user || !active) return;

        const actorId = userData.user.id;
        const storageKey = `inout:pending-record:v1:${actorId}:${householdId}`;
        const raw = await AsyncStorage.getItem(storageKey);

        if (raw && active) {
          try {
            const parsed = JSON.parse(raw);
            const body = parsed.body || {};
            const kind = (parsed.kind as RecordKind) || initialKind;
            const amount =
              typeof body.amountCents === "number"
                ? body.amountCents
                : initialAmount;
            const desc = body.description || initialDescription;
            const date =
              body.occurredOn ||
              initialDate ||
              new Date().toISOString().slice(0, 10);

            setData({
              kind,
              description: desc,
              amount,
              currency: initialCurrency,
              accountName: initialAccount,
              date,
              period: date.slice(0, 7),
              hasStoredPending: true,
            });
          } catch {
            // keep initial data
          }
        }
      } catch {
        // auth or async storage error
      }
    }

    if (householdId) {
      void loadPending();
    }

    return () => {
      active = false;
    };
  }, [
    householdId,
    initialKind,
    initialDescription,
    initialAmount,
    initialDate,
    initialCurrency,
    initialAccount,
  ]);

  const verify = useCallback(async () => {
    if (!householdId || status === "verifying") return;

    setStatus("verifying");
    setNotice("");

    try {
      const { data: userData } = await getAuthClient().auth.getUser();
      const actorId = userData?.user?.id;
      const storageKey = actorId
        ? `inout:pending-record:v1:${actorId}:${householdId}`
        : null;
      const rawStored = storageKey
        ? await AsyncStorage.getItem(storageKey)
        : null;

      // 1. If stored pending record exists, submit idempotent replay to real backend
      if (rawStored) {
        const parsed = JSON.parse(rawStored);
        const result = await repository.postRecord(
          householdId,
          parsed.kind,
          parsed.body,
          parsed.key,
        );

        if (result && result.transactionId) {
          if (storageKey) await AsyncStorage.removeItem(storageKey);
          setConfirmedTransaction(result.transactionId);
          setStatus("confirmed");
          return;
        }
      }

      // 2. Query real backend ledger history
      const history = await repository.ledgerHistory(
        householdId,
        data.period,
        data.description ? { search: data.description } : undefined,
        0,
      );

      const match = history.items.find((item: HistoryItem) => {
        const sameDate = item.date === data.date;
        const sameAmount = Math.abs(item.amount) === Math.abs(data.amount);
        const sameDesc =
          !data.description || item.description === data.description;
        return sameDate && (sameAmount || sameDesc);
      });

      if (match) {
        if (storageKey) await AsyncStorage.removeItem(storageKey);
        setConfirmedTransaction(match.transactionId);
        setStatus("confirmed");
      } else {
        setStatus("uncertain");
        setNotice(
          "Ainda em processamento pelo servidor. Tente novamente em instantes.",
        );
      }
    } catch (err) {
      const msg = financeMessage(err);
      setStatus("uncertain");
      setNotice(msg || "Não foi possível confirmar o registro no momento.");
    }
  }, [householdId, status, repository, data]);

  return {
    data,
    status,
    confirmedTransaction,
    notice,
    verify,
  };
}
