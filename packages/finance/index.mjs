export class FinanceFailure extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
export function financeMessage(error) {
  const messages = {
    configuration:
      "Configure o endereço do backend para carregar suas finanças.",
    unauthorized: "Sua sessão expirou. Entre novamente.",
    forbidden:
      "Você não tem acesso a esta residência. Atualize suas residências.",
    network:
      "Não foi possível acessar o backend. Confira a conexão e tente novamente.",
    invalid: "O backend retornou dados financeiros inválidos.",
    server: "Não foi possível carregar suas finanças. Tente novamente.",
    timeout: "O backend demorou para responder. Tente novamente.",
  };
  return messages[error?.code] ?? messages.server;
}
function integer(value) {
  if (!Number.isSafeInteger(value)) throw new FinanceFailure("invalid");
  return value;
}
function string(value) {
  if (typeof value !== "string") throw new FinanceFailure("invalid");
  return value;
}
function array(value) {
  if (!Array.isArray(value)) throw new FinanceFailure("invalid");
  return value;
}
function currency(value) {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value))
    throw new FinanceFailure("invalid");
  return value;
}
function date(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new FinanceFailure("invalid");
  return value;
}
function dashboard(value) {
  if (!value || typeof value.isReconciled !== "boolean")
    throw new FinanceFailure("invalid");
  return {
    periodStart: date(value.periodStart),
    periodEnd: date(value.periodEnd),
    isReconciled: value.isReconciled,
    summaries: array(value.summaries).map((row) => ({
      currency: currency(row.currency),
      balance: integer(row.consolidatedBalanceCents),
      income: integer(row.incomeCents),
      expense: integer(row.expenseCents),
      result: integer(row.resultCents),
    })),
    accounts: array(value.accounts).map((row) => ({
      id: string(row.accountId),
      name: string(row.accountName),
      currency: currency(row.currency),
    })),
  };
}
export function monthOptions(now = new Date()) {
  return Array.from({ length: 12 }, (_, index) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}
export function periodLabel(period) {
  const [y, m] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, 1));
}
export function money(cents, code) {
  const value = BigInt(integer(cents));
  const absolute = value < 0n ? -value : value;
  const fraction = String(absolute % 100n).padStart(2, "0");
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "always",
  })
    .formatToParts(absolute / 100n)
    .map((part) =>
      part.type === "plusSign"
        ? value < 0n
          ? "-"
          : ""
        : part.type === "fraction"
          ? fraction
          : part.value,
    )
    .join("");
}

export function createFinanceRepository({
  baseUrl,
  getToken,
  fetcher = fetch,
}) {
  async function get(path, signal) {
    let base;
    try {
      base = new URL(baseUrl);
      if (
        !["https:", "http:"].includes(base.protocol) ||
        base.username ||
        base.password ||
        base.search ||
        base.hash
      )
        throw Error();
    } catch {
      throw new FinanceFailure("configuration");
    }
    const token = await getToken();
    signal?.throwIfAborted();
    if (!token) throw new FinanceFailure("unauthorized");
    let response;
    try {
      response = await fetcher(`${base.href.replace(/\/$/, "")}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal,
        redirect: "error",
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new FinanceFailure("network");
    }
    if (!response.ok)
      throw new FinanceFailure(
        response.status === 401
          ? "unauthorized"
          : response.status === 403
            ? "forbidden"
            : "server",
      );
    try {
      return await response.json();
    } catch {
      throw new FinanceFailure("invalid");
    }
  }
  return {
    async households(signal) {
      return array(await get("/api/v1/households", signal)).map((row) => ({
        id: string(row.id),
        name: string(row.name),
      }));
    },
    async home(householdId, period, signal) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))
        throw new FinanceFailure("invalid");
      const [year, month] = period.split("-").map(Number);
      const periods = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(year, month - 6 + i, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      });
      const root = `/api/v1/households/${encodeURIComponent(householdId)}/ledger`;
      const start = `${period}-01`;
      const end = `${period}-${new Date(year, month, 0).getDate()}`;
      const [dashboards, rawHistory] = await Promise.all([
        Promise.all(
          periods.map(async (p) => {
            const [y, m] = p.split("-");
            const d = dashboard(
              await get(
                `${root}/dashboard?year=${y}&month=${Number(m)}`,
                signal,
              ),
            );
            if (d.periodStart !== `${p}-01`)
              throw new FinanceFailure("invalid");
            return { ...d, period: p };
          }),
        ),
        get(`${root}/history?from=${start}&to=${end}&limit=20`, signal),
      ]);
      const selected = dashboards[5];
      const rows = array(rawHistory)
        .map((row) => {
          if (!["credit", "debit"].includes(row.direction))
            throw new FinanceFailure("invalid");
          const amount = integer(row.amountCents);
          if (amount < 0) throw new FinanceFailure("invalid");
          return {
            id: `${string(row.transactionId)}:${string(row.accountId)}:${row.direction}`,
            name:
              row.description == null
                ? string(row.accountName)
                : string(row.description),
            accountName: string(row.accountName),
            category:
              row.kind === "transfer"
                ? "Transferência · fora do resultado"
                : (row.categoryName ??
                  row.incomeSourceName ??
                  string(row.kind)),
            date: date(row.occurredOn),
            cents: row.direction === "credit" ? amount : -amount,
            currency: currency(row.currency),
            kind: string(row.kind),
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date));
      return {
        ...selected,
        history: dashboards.map((d) => ({
          period: d.period,
          summaries: d.summaries,
        })),
        transactions: rows,
        currencies: [
          ...new Set(selected.summaries.map((row) => row.currency)),
        ].sort(),
        isReconciled: dashboards.every((d) => d.isReconciled),
      };
    },
  };
}
export function createFinancialHomeStore(
  repository,
  { now = new Date(), timeoutMs = 20000 } = {},
) {
  const periods = monthOptions(now);
  let state = {
    status: "loading",
    households: [],
    householdId: "",
    period: periods[11],
    periods,
    data: null,
    notice: "",
  };
  const listeners = new Set();
  let active = false,
    version = 0,
    controller,
    timer;
  function publish(value) {
    state = { ...state, ...value };
    listeners.forEach((fn) => fn());
  }
  function cancel() {
    version++;
    controller?.abort();
    clearTimeout(timer);
  }
  async function run(refreshHouseholds = false) {
    cancel();
    const id = version;
    controller = new AbortController();
    const signal = controller.signal;
    publish({ status: "loading", data: null, notice: "" });
    timer = setTimeout(() => {
      if (active && id === version) {
        cancel();
        publish({
          status: "error",
          data: null,
          notice: financeMessage(new FinanceFailure("timeout")),
        });
      }
    }, timeoutMs);
    try {
      const households = refreshHouseholds
        ? await repository.households(signal)
        : state.households;
      if (!active || id !== version) return;
      const householdId = households.some((h) => h.id === state.householdId)
        ? state.householdId
        : (households[0]?.id ?? "");
      publish({ households, householdId });
      if (!householdId) {
        publish({ status: "empty", data: null });
        return;
      }
      const data = await repository.home(householdId, state.period, signal);
      if (active && id === version) publish({ status: "ready", data });
    } catch (error) {
      if (active && id === version) {
        publish({
          status: "error",
          data: null,
          notice: financeMessage(error),
          ...(error?.code === "forbidden" || error?.code === "unauthorized"
            ? { households: [], householdId: "" }
            : {}),
        });
      }
    } finally {
      if (id === version) clearTimeout(timer);
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    start() {
      active = true;
      void run(true);
      return () => {
        active = false;
        cancel();
      };
    },
    retry() {
      if (active) void run(true);
    },
    selectHousehold(id) {
      if (
        id === state.householdId ||
        !state.households.some((h) => h.id === id)
      )
        return;
      publish({ householdId: id, data: null, status: "loading" });
      if (active) void run();
    },
    selectPeriod(period) {
      if (period === state.period || !periods.includes(period)) return;
      publish({ period, data: null, status: "loading" });
      if (active) void run();
    },
  };
}
