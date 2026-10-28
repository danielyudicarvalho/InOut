export class FinanceFailure extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
export function financeMessage(error) {
  const messages = {
    validation: "Confira os dados do lançamento e tente novamente.",
    conflict:
      "Esta tentativa ainda não pôde ser concluída. Aguarde e tente novamente.",
    storage:
      "Não foi possível proteger esta tentativa no dispositivo. Nenhum novo envio foi iniciado.",
    pending:
      "Há uma tentativa pendente. Confirme seu resultado antes de iniciar outro lançamento.",
    changed:
      "Os lançamentos mudaram durante a consulta. Atualize para carregá-los novamente.",
    period:
      "Informe datas válidas; a data inicial não pode ser posterior à final.",
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
  if (
    value.hasFinancialActivity != null &&
    typeof value.hasFinancialActivity !== "boolean"
  )
    throw new FinanceFailure("invalid");
  return {
    hasFinancialActivity: value.hasFinancialActivity ?? null,
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
      balance: integer(row.balanceCents),
      initialBalance:
        row.initialBalanceCents == null
          ? null
          : integer(row.initialBalanceCents),
      inflow: integer(row.inflowCents),
      outflow: integer(row.outflowCents),
      change: integer(row.netChangeCents),
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
  if (period.includes("/")) {
    const { from, to } = parsePeriod(period);
    return `${displayDate(from)} a ${displayDate(to)}`;
  }
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
  async function get(path, signal, write) {
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
          ...(write
            ? {
                "Content-Type": "application/json",
                "Idempotency-Key": write.key,
              }
            : {}),
        },
        ...(write ? { method: "POST", body: JSON.stringify(write.body) } : {}),
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
            : response.status === 400 || response.status === 422
              ? "validation"
              : response.status === 409
                ? "conflict"
                : "server",
      );
    try {
      return await response.json();
    } catch {
      throw new FinanceFailure("invalid");
    }
  }
  async function breakdown(kind, householdId, period, code, offset, signal) {
    const bounds = parsePeriod(period);
    const query = bounds.custom
      ? `from=${bounds.from}&to=${bounds.to}`
      : `year=${period.slice(0, 4)}&month=${Number(period.slice(5))}`;
    const raw = await get(
      `/api/v1/households/${encodeURIComponent(householdId)}/ledger/dashboard/${kind}?currency=${encodeURIComponent(currency(code))}&${query}&offset=${integer(offset)}&limit=50`,
      signal,
    );
    if (
      !raw ||
      raw.currency !== code ||
      raw.periodStart !== bounds.from ||
      raw.periodEnd !== bounds.to ||
      typeof raw.isReconciled !== "boolean"
    )
      throw new FinanceFailure("invalid");
    if (
      typeof raw.snapshotId !== "string" ||
      !/^[0-9A-F]{64}$/.test(raw.snapshotId)
    )
      throw new FinanceFailure("invalid");
    const totalCount = integer(raw.totalCount),
      returnedOffset = integer(raw.offset);
    if (totalCount < 0 || returnedOffset !== offset || offset > totalCount)
      throw new FinanceFailure("invalid");
    const items = array(raw.items).map((row) => {
      if (kind === "expense" && !("categoryId" in row))
        throw new FinanceFailure("invalid");
      if (typeof row.isReversal !== "boolean")
        throw new FinanceFailure("invalid");
      return {
        id: string(row.entryId),
        transactionId: string(row.transactionId),
        accountId: string(row.accountId),
        accountName: string(row.accountName),
        date: date(row.occurredOn),
        description: row.description == null ? null : string(row.description),
        category: row.categoryName == null ? null : string(row.categoryName),
        categoryId: row.categoryId == null ? null : string(row.categoryId),
        source:
          row.incomeSourceName == null ? null : string(row.incomeSourceName),
        sourceId:
          row.incomeSourceId == null ? null : string(row.incomeSourceId),
        amount: integer(row.amountCents),
        isReversal: row.isReversal === true,
        reversalOf: row.reversalOf == null ? null : string(row.reversalOf),
      };
    });
    if (
      items.length > 50 ||
      items.length + offset > totalCount ||
      (items.length === 0 && offset < totalCount)
    )
      throw new FinanceFailure("invalid");
    let sources;
    if (kind === "income" && raw.sources !== undefined) {
      sources = array(raw.sources).map((row) => {
        const count = integer(row.entryCount);
        if (count <= 0) throw new FinanceFailure("invalid");
        return {
          id: row.incomeSourceId == null ? null : string(row.incomeSourceId),
          name: string(row.incomeSourceName),
          amount: integer(row.amountCents),
          count,
        };
      });
      if (
        new Set(sources.map((row) => row.id)).size !== sources.length ||
        sources.reduce((sum, row) => sum + BigInt(row.amount), 0n) !==
          BigInt(integer(raw.totalCents)) ||
        sources.reduce((sum, row) => sum + BigInt(row.count), 0n) !==
          BigInt(totalCount)
      )
        throw new FinanceFailure("invalid");
      for (const item of items) {
        if (!sources.some((row) => row.id === item.sourceId))
          throw new FinanceFailure("invalid");
      }
    }
    return {
      sources,
      periodStart: bounds.from,
      periodEnd: bounds.to,
      currency: code,
      total: integer(raw.totalCents),
      totalCount,
      snapshotId: raw.snapshotId,
      offset: returnedOffset,
      isReconciled: raw.isReconciled,
      items,
    };
  }
  return {
    async ledgerHistory(householdId, period, filters = {}, offset = 0, signal) {
      const homes = await this.households(signal);
      if (!homes.some((h) => h.id === householdId))
        throw new FinanceFailure("forbidden");
      if (!Number.isSafeInteger(offset) || offset < 0)
        throw new FinanceFailure("validation");
      const bounds = parsePeriod(period);
      const query = new URLSearchParams({
        from: bounds.from,
        to: bounds.to,
        limit: "51",
        offset: String(offset),
      });
      for (const key of [
        "transactionId",
        "search",
        "kind",
        "accountId",
        "categoryId",
        "incomeSourceId",
      ])
        if (filters[key]) query.set(key, filters[key]);
      if (filters.includeSubcategories)
        query.set("includeSubcategories", "true");
      const rows = array(
        await get(
          `/api/v1/households/${encodeURIComponent(householdId)}/ledger/history?${query}`,
          signal,
        ),
      ).map((row) => {
        const direction = string(row.direction).toLowerCase();
        if (
          !["debit", "credit"].includes(direction) ||
          integer(row.amountCents) < 0
        )
          throw new FinanceFailure("invalid");
        return {
          transactionId: string(row.transactionId),
          accountId: string(row.accountId),
          accountName: string(row.accountName),
          description:
            row.description == null ? "Sem descrição" : string(row.description),
          date: string(row.occurredOn),
          kind: string(row.kind).toLowerCase(),
          status: string(row.status).toLowerCase(),
          amount:
            integer(row.amountCents) *
            (string(row.direction).toLowerCase() === "debit" ? -1 : 1),
          currency: currency(row.currency),
          category:
            row.categoryName == null
              ? "Sem categoria"
              : string(row.categoryName),
          source:
            row.incomeSourceName == null ? null : string(row.incomeSourceName),
          reversalOf: row.reversalOf == null ? null : string(row.reversalOf),
        };
      });
      if (
        filters.transactionId &&
        rows.some(
          (row) =>
            row.transactionId.toLowerCase() !==
            filters.transactionId.toLowerCase(),
        )
      )
        throw new FinanceFailure("invalid");
      return { items: rows.slice(0, 50), hasMore: rows.length > 50 };
    },
    async historyOptions(householdId, signal) {
      const homes = await this.households(signal);
      if (!homes.some((h) => h.id === householdId))
        throw new FinanceFailure("forbidden");
      const root = `/api/v1/households/${encodeURIComponent(householdId)}/ledger`;
      const [accounts, categories, sources] = await Promise.all([
        get(`${root}/accounts?includeArchived=true`, signal),
        get(`${root}/categories?includeArchived=true`, signal),
        get(`${root}/income-sources?includeArchived=true`, signal),
      ]);
      return {
        accounts: array(accounts).map((a) => ({
          id: string(a.id),
          name: string(a.name),
          currency: currency(a.currency),
        })),
        categories: array(categories).map((c) => ({
          id: string(c.id),
          name: string(c.name),
          flow: string(c.flow).toLowerCase(),
          parentId: c.parentId == null ? null : string(c.parentId),
        })),
        sources: array(sources).map((s) => ({
          id: string(s.id),
          name: string(s.name),
        })),
      };
    },
    async households(signal) {
      return array(await get("/api/v1/households", signal)).map((row) => ({
        id: string(row.id),
        name: string(row.name),
      }));
    },
    income(householdId, period, code, offset, signal) {
      return breakdown("income", householdId, period, code, offset, signal);
    },
    expense(householdId, period, code, offset, signal) {
      return breakdown("expense", householdId, period, code, offset, signal);
    },
    async accountOptions(householdId, signal) {
      const homes = array(await get("/api/v1/households", signal));
      if (!homes.some((row) => row.id === householdId))
        throw new FinanceFailure("forbidden");
      return { accounts: [], categories: [], sources: [] };
    },
    async createAccount(householdId, body, key, signal) {
      if (!validOperationKey(key)) throw new FinanceFailure("validation");
      const result = await get(
        `/api/v1/households/${encodeURIComponent(householdId)}/ledger/accounts`,
        signal,
        { body, key },
      );
      if (
        !result ||
        typeof result.replayed !== "boolean" ||
        !result.account ||
        typeof result.account.id !== "string" ||
        result.account.id.toLowerCase() !== body.id.toLowerCase()
      )
        throw new FinanceFailure("invalid");
      return {
        accountId: string(result.account.id),
        currency: currency(result.account.currency),
        name: string(result.account.name),
        replayed: result.replayed,
      };
    },
    async createAuxiliary(household, kind, body, key, signal) {
      if (kind === "account") {
        const result = await this.createAccount(household, body, key, signal);
        return { id: result.accountId };
      }
      const endpoint =
        kind === "category"
          ? "categories"
          : kind === "source"
            ? "income-sources"
            : null;
      if (!endpoint) throw new FinanceFailure("validation");
      const root = `/api/v1/households/${encodeURIComponent(household)}/ledger/${endpoint}`;
      // Recover an uncertain response using the same entity identifier, including sources without a server idempotency header.
      const existing = array(
        await get(`${root}?includeArchived=true`, signal),
      ).find((item) => item.id.toLowerCase() === body.id.toLowerCase());
      if (existing) {
        if (
          existing.name !== body.name ||
          existing.archivedAt != null ||
          (kind === "category" &&
            (existing.flow.toLowerCase() !== body.flow ||
              (existing.parentId ?? null) !== body.parentId))
        )
          throw new FinanceFailure("conflict");
        return { id: string(existing.id) };
      }
      const result = await get(root, signal, { body, key });
      if (!result || string(result.id).toLowerCase() !== body.id.toLowerCase())
        throw new FinanceFailure("invalid");
      return { id: string(result.id) };
    },
    async recordOptions(householdId, signal) {
      const homes = array(await get("/api/v1/households", signal));
      if (!homes.some((row) => row.id === householdId))
        throw new FinanceFailure("forbidden");
      const root = `/api/v1/households/${encodeURIComponent(householdId)}/ledger`;
      const [accounts, categories, sources] = await Promise.all([
        get(`${root}/accounts`, signal),
        get(`${root}/categories`, signal),
        get(`${root}/income-sources`, signal),
      ]);
      return {
        accounts: array(accounts)
          .filter((row) => row.archivedAt == null)
          .map((row) => ({
            id: string(row.id),
            name: string(row.name),
            currency: currency(row.currency),
          })),
        categories: array(categories)
          .filter((row) => row.archivedAt == null)
          .map((row) => {
            const flow = string(row.flow).toLowerCase();
            if (!["income", "expense"].includes(flow))
              throw new FinanceFailure("invalid");
            return {
              id: string(row.id),
              name: string(row.name),
              flow,
              ...(row.parentId == null
                ? {}
                : { parentId: string(row.parentId) }),
            };
          }),
        sources: array(sources)
          .filter((row) => row.archivedAt == null)
          .map((row) => ({ id: string(row.id), name: string(row.name) })),
      };
    },
    async postRecord(householdId, kind, body, key, signal) {
      const endpoint = {
        income: "income",
        expense: "expenses",
        transfer: "transfers",
      }[kind];
      if (!endpoint || !validOperationKey(key))
        throw new FinanceFailure("validation");
      const result = await get(
        `/api/v1/households/${encodeURIComponent(householdId)}/ledger/${endpoint}`,
        signal,
        { body, key },
      );
      if (
        !result ||
        typeof result.replayed !== "boolean" ||
        typeof result.transactionId !== "string" ||
        !result.transactionId
      )
        throw new FinanceFailure("invalid");
      return { transactionId: result.transactionId, replayed: result.replayed };
    },
    async categorySummary(householdId, period, code, signal) {
      const bounds = parsePeriod(period);
      const query = bounds.custom
        ? `from=${bounds.from}&to=${bounds.to}`
        : `year=${period.slice(0, 4)}&month=${Number(period.slice(5))}`;
      const root = `/api/v1/households/${encodeURIComponent(householdId)}/ledger`;
      const [d, catalog] = await Promise.all([
        get(`${root}/dashboard?${query}`, signal),
        get(`${root}/categories?includeArchived=true`, signal),
      ]);
      if (
        !d ||
        d.periodStart !== bounds.from ||
        d.periodEnd !== bounds.to ||
        typeof d.isReconciled !== "boolean"
      )
        throw new FinanceFailure("invalid");
      const summary = array(d.summaries).find((row) => row.currency === code);
      if (!summary) throw new FinanceFailure("invalid");
      return buildCategorySummary(
        array(catalog).map((row) => ({
          id: string(row.id),
          name: string(row.name),
          parentId: row.parentId == null ? null : string(row.parentId),
        })),
        array(d.categoryExpenses)
          .filter((row) => row.currency === code)
          .map((row) => ({
            id: string(row.categoryId),
            amount: integer(row.amountCents),
          })),
        integer(summary.expenseCents),
        d.isReconciled,
      );
    },
    async home(householdId, period, signal) {
      const bounds = parsePeriod(period);
      const [year, month] = bounds.from.split("-").map(Number);
      const periods = bounds.custom
        ? [period]
        : Array.from({ length: 6 }, (_, i) => {
            const d = new Date(year, month - 6 + i, 1);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          }).filter((p) => Number(p.slice(0, 4)) >= 2000);
      const root = `/api/v1/households/${encodeURIComponent(householdId)}/ledger`;
      const start = bounds.from,
        end = bounds.to;
      const [dashboards, rawHistory, rawAccounts] = await Promise.all([
        Promise.all(
          periods.map(async (p) => {
            const range = parsePeriod(p);
            const query = range.custom
              ? `from=${range.from}&to=${range.to}`
              : `year=${p.slice(0, 4)}&month=${Number(p.slice(5))}`;
            const d = dashboard(
              await get(`${root}/dashboard?${query}`, signal),
            );
            if (
              d.periodStart !== range.from ||
              (range.custom && d.periodEnd !== range.to)
            )
              throw new FinanceFailure("invalid");
            return { ...d, period: p };
          }),
        ),
        get(`${root}/history?from=${start}&to=${end}&limit=20`, signal),
        get(`${root}/accounts`, signal),
      ]);
      const selected = dashboards[dashboards.length - 1];
      const kinds = new Map(
        array(rawAccounts).map((row) => [string(row.id), string(row.kind)]),
      );
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
        setupAccounts: array(rawAccounts)
          .filter((row) => row.archivedAt == null)
          .map((row) => ({
            id: string(row.id),
            name: string(row.name),
            currency: currency(row.currency),
            balance: integer(row.balanceCents),
            initialBalance:
              selected.accounts.find((account) => account.id === row.id)
                ?.initialBalance ?? null,
          })),
        accounts: selected.accounts.map((account) => ({
          ...account,
          kind: kinds.get(account.id) ?? null,
        })),
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
  {
    now = new Date(),
    timeoutMs = 20000,
    initialHouseholdId = "",
    initialPeriod,
  } = {},
) {
  const periods = monthOptions(now);
  let selectedPeriod = periods[11];
  if (initialPeriod) {
    try {
      parsePeriod(initialPeriod);
      selectedPeriod = initialPeriod;
    } catch {}
  }
  let state = {
    status: "loading",
    households: [],
    householdId: initialHouseholdId,
    period: selectedPeriod,
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
      if (
        state.householdId &&
        !households.some((h) => h.id === state.householdId)
      )
        throw new FinanceFailure("forbidden");
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
      if (period === state.period) return;
      try {
        parsePeriod(period);
      } catch {
        return;
      }
      publish({ period, data: null, status: "loading" });
      if (active) void run();
    },
  };
}

export function rangePeriod(from, to) {
  const valid = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      return false;
    const [y, m, d] = value.split("-").map(Number);
    if (
      y < 2000 ||
      y > 9998 ||
      m < 1 ||
      m > 12 ||
      d < 1 ||
      d > new Date(y, m, 0).getDate()
    )
      return false;
    return true;
  };
  if (!valid(from) || !valid(to) || from > to)
    throw new FinanceFailure("period");
  return `${from}/${to}`;
}
export function parsePeriod(period) {
  if (typeof period !== "string") throw new FinanceFailure("period");
  if (period.includes("/")) {
    const parts = period.split("/");
    if (parts.length !== 2) throw new FinanceFailure("period");
    rangePeriod(parts[0], parts[1]);
    return { from: parts[0], to: parts[1], custom: true };
  }
  if (
    !/^(20\d{2}|[3-9]\d{3})-(0[1-9]|1[0-2])$/.test(period) ||
    period.slice(0, 4) === "9999"
  )
    throw new FinanceFailure("period");
  const [y, m] = period.split("-").map(Number);
  return {
    from: `${period}-01`,
    to: `${period}-${new Date(y, m, 0).getDate()}`,
    custom: false,
  };
}
export function presetPeriod(preset, now = new Date()) {
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (preset === "current") return current;
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  if (preset === "previous")
    return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
  const first = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  if (preset !== "quarter") throw new FinanceFailure("period");
  return rangePeriod(
    `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}-01`,
    parsePeriod(current).to,
  );
}
export function calendarDays(month) {
  const { from, to } = parsePeriod(month);
  const [year, m] = from.split("-").map(Number);
  const offset = (new Date(year, m - 1, 1).getDay() + 6) % 7;
  return Array.from(
    { length: Math.ceil((offset + Number(to.slice(8))) / 7) * 7 },
    (_, index) => {
      const day = index - offset + 1;
      return day < 1 || day > Number(to.slice(8))
        ? null
        : `${month}-${String(day).padStart(2, "0")}`;
    },
  );
}
export function displayDate(value) {
  return value.split("-").reverse().join("/");
}
export function inputDate(value) {
  const parts = value.split("/");
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : "";
}

export function accountKindLabel(kind) {
  return (
    {
      cash: "Dinheiro",
      checking: "Conta corrente",
      savings: "Poupança",
      investment: "Investimento",
      other: "Outros",
    }[kind] ?? "Conta financeira"
  );
}
export function balanceComposition(home, code) {
  const rows = home.accounts.filter((a) => a.currency === code);
  const total = home.summaries.find((s) => s.currency === code)?.balance;
  if (total === undefined) throw new FinanceFailure("invalid");
  const sum = rows.reduce((v, a) => v + BigInt(integer(a.balance)), 0n);
  const magnitude = rows.reduce(
    (v, a) =>
      v + (BigInt(a.balance) < 0n ? -BigInt(a.balance) : BigInt(a.balance)),
    0n,
  );
  return {
    total,
    matched: sum === BigInt(total),
    accounts: rows.map((a) => {
      const amount = BigInt(a.balance);
      const abs = amount < 0n ? -amount : amount;
      const percent =
        total === 0 ? null : Number((amount * 1000n) / BigInt(total)) / 10;
      return {
        ...a,
        percent,
        width: magnitude === 0n ? 0 : Number((abs * 10000n) / magnitude) / 100,
      };
    }),
  };
}

export function createIncomeDetailsStore(
  repository,
  householdId,
  period,
  code,
  { timeoutMs = 20000, kind = "income" } = {},
) {
  let state = { status: "loading", data: null, notice: "", loadingMore: false };
  let active = false,
    version = 0,
    controller,
    timer;
  const listeners = new Set();
  function publish(value) {
    state = { ...state, ...value };
    listeners.forEach((fn) => fn());
  }
  function cancel() {
    version++;
    controller?.abort();
    clearTimeout(timer);
  }
  async function load(append = false) {
    if (
      append &&
      (state.loadingMore ||
        !state.data ||
        state.data.items.length >= state.data.totalCount)
    )
      return;
    const previous = append ? state.data : null;
    cancel();
    const id = version;
    controller = new AbortController();
    const signal = controller.signal;
    publish(
      append
        ? { loadingMore: true, notice: "" }
        : { status: "loading", data: null, notice: "", loadingMore: false },
    );
    timer = setTimeout(() => {
      if (active && id === version) {
        cancel();
        publish({
          status: append ? "ready" : "error",
          loadingMore: false,
          notice: financeMessage(new FinanceFailure("timeout")),
        });
      }
    }, timeoutMs);
    try {
      const page = await repository[kind](
        householdId,
        period,
        code,
        previous?.items.length ?? 0,
        signal,
      );
      if (!active || id !== version) return;
      if (
        previous &&
        (page.snapshotId !== previous.snapshotId ||
          page.total !== previous.total ||
          page.totalCount !== previous.totalCount ||
          page.isReconciled !== previous.isReconciled)
      )
        throw new FinanceFailure("changed");
      const items = previous ? [...previous.items, ...page.items] : page.items;
      if (new Set(items.map((row) => row.id)).size !== items.length)
        throw new FinanceFailure("changed");
      publish({
        status: "ready",
        data: { ...page, offset: 0, items },
        notice: "",
        loadingMore: false,
      });
    } catch (error) {
      if (active && id === version) {
        const accessLost =
          error?.code === "forbidden" || error?.code === "unauthorized";
        publish({
          status: accessLost ? "error" : append ? "ready" : "error",
          data: accessLost ? null : state.data,
          notice: financeMessage(error),
          loadingMore: false,
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
      void load();
      return () => {
        active = false;
        cancel();
      };
    },
    retry() {
      if (active) void load();
    },
    loadMore() {
      if (active) void load(true);
    },
  };
}

export function recentResultEntries(income, expense, filter = "all") {
  return [
    ...(filter !== "expense"
      ? income.map((item) => ({ ...item, flow: "income" }))
      : []),
    ...(filter !== "income"
      ? expense.map((item) => ({ ...item, flow: "expense" }))
      : []),
  ]
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.transactionId.localeCompare(a.transactionId) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 4);
}

export function buildCategorySummary(
  catalog,
  values,
  total,
  isReconciled = true,
) {
  const nodes = new Map(
    catalog.map((c) => [c.id, { ...c, direct: 0n, sum: 0n, children: [] }]),
  );
  for (const value of values) {
    const node = nodes.get(value.id);
    if (!node) throw new FinanceFailure("invalid");
    node.direct += BigInt(value.amount);
  }
  for (const node of nodes.values()) {
    let parent = node.parentId,
      seen = new Set([node.id]);
    while (parent && nodes.has(parent)) {
      if (seen.has(parent)) throw new FinanceFailure("invalid");
      seen.add(parent);
      parent = nodes.get(parent).parentId;
    }
  }
  const roots = [];
  for (const node of nodes.values()) {
    const parent = nodes.get(node.parentId);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const convert = (value) => {
    const number = Number(value);
    if (!Number.isSafeInteger(number)) throw new FinanceFailure("invalid");
    return number;
  };
  function visit(node) {
    const children = node.children
      .map(visit)
      .filter((child) => child.amount !== 0 || child.children.length);
    const amount =
      node.direct + children.reduce((n, child) => n + BigInt(child.amount), 0n);
    return {
      id: node.id,
      name: node.name,
      amount: convert(amount),
      direct: convert(node.direct),
      children,
    };
  }
  const groups = roots
    .map(visit)
    .filter((node) => node.amount !== 0 || node.children.length);
  const classified = groups.reduce(
    (sum, node) => sum + BigInt(node.amount),
    0n,
  );
  const unclassified = BigInt(total) - classified;
  if (unclassified !== 0n)
    groups.push({
      id: null,
      name: "Sem categoria",
      amount: convert(unclassified),
      direct: convert(unclassified),
      children: [],
    });
  groups.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  return { total, isReconciled, groups };
}

function validOperationKey(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    ) &&
    value !== "00000000-0000-0000-0000-000000000000"
  );
}
export function recordAmount(value) {
  if (
    typeof value !== "string" ||
    !/^\d{1,16}([,.]\d{1,2})?$/.test(value.trim())
  )
    throw new FinanceFailure("validation");
  const [whole, fraction = ""] = value.trim().replace(",", ".").split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  const amount = Number(cents);
  if (amount <= 0 || !Number.isSafeInteger(amount))
    throw new FinanceFailure("validation");
  return amount;
}
export function prepareRecord(kind, fields, options) {
  if (!["income", "expense", "transfer"].includes(kind))
    throw new FinanceFailure("validation");
  const account = options.accounts.find((row) => row.id === fields.accountId);
  if (!account) throw new FinanceFailure("validation");
  try {
    rangePeriod(fields.date, fields.date);
  } catch {
    throw new FinanceFailure("validation");
  }
  const description = string(fields.description).trim();
  if (description.length > 500) throw new FinanceFailure("validation");
  const common = {
    amountCents: recordAmount(fields.amount),
    currency: account.currency,
    occurredOn: fields.date,
    description: description || null,
  };
  if (kind === "transfer") {
    const destination = options.accounts.find(
      (row) => row.id === fields.destinationId,
    );
    if (
      !destination ||
      destination.id === account.id ||
      destination.currency !== account.currency
    )
      throw new FinanceFailure("validation");
    return {
      sourceAccountId: account.id,
      destinationAccountId: destination.id,
      ...common,
    };
  }
  const category = options.categories.find(
    (row) => row.id === fields.categoryId && row.flow === kind,
  );
  if (
    !category ||
    (kind === "income" &&
      fields.sourceId &&
      !options.sources.some((row) => row.id === fields.sourceId))
  )
    throw new FinanceFailure("validation");
  return {
    accountId: account.id,
    categoryId: category.id,
    ...common,
    ...(kind === "income" ? { incomeSourceId: fields.sourceId || null } : {}),
  };
}
function createWriteStore(
  repository,
  householdId,
  initialKind,
  preferredCurrency,
  { storage, randomId, now = () => new Date(), timeoutMs = 20000, spec },
) {
  const today = now();
  let state = {
    status: "loading",
    kind: initialKind,
    fields: spec.initialFields(today, preferredCurrency),
    options: null,
    notice: "",
    result: null,
  };
  let active = false,
    version = 0,
    controller,
    timer,
    pending = null;
  const listeners = new Set();
  const publish = (patch) => {
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn());
  };
  function cancel() {
    version++;
    controller?.abort();
    clearTimeout(timer);
  }
  async function load() {
    cancel();
    const id = version;
    controller = new AbortController();
    publish({ status: "loading", options: null, notice: "" });
    timer = setTimeout(() => {
      if (active && id === version) {
        cancel();
        publish({
          status: "error",
          notice: financeMessage(new FinanceFailure("timeout")),
        });
      }
    }, timeoutMs);
    try {
      const raw = await storage.load();
      if (!active || id !== version) return;
      pending = null;
      if (raw) {
        pending = JSON.parse(raw);
        const age = now().getTime() - pending.createdAt;
        if (
          pending.version !== 1 ||
          pending.householdId !== householdId ||
          !spec.kinds.includes(pending.kind) ||
          !validOperationKey(pending.key) ||
          !Number.isFinite(age) ||
          age < 0 ||
          age > 30 * 86400000 ||
          !pending.body
        )
          throw new FinanceFailure("pending");
        spec.restore(pending.body);
      }
      const options = await spec.options(
        repository,
        householdId,
        controller.signal,
      );
      if (!active || id !== version) return;
      if (pending) {
        publish({
          status: "uncertain",
          kind: pending.kind,
          options,
          fields: spec.restore(pending.body),
          notice: financeMessage(new FinanceFailure("pending")),
        });
      } else {
        if (!spec.kinds.includes(initialKind))
          throw new FinanceFailure("validation");
        publish({
          status: "ready",
          options,
          fields: spec.initialize(state.fields, options, preferredCurrency),
        });
      }
    } catch (error) {
      if (active && id === version)
        publish({
          status: "error",
          options: null,
          notice: financeMessage(error),
        });
    } finally {
      if (id === version) clearTimeout(timer);
    }
  }
  async function submit() {
    if (
      !active ||
      !["ready", "uncertain"].includes(state.status) ||
      !state.options
    )
      return;
    let body, key;
    try {
      body =
        pending?.body ??
        spec.prepare(state.kind, state.fields, state.options, randomId);
      key = pending?.key ?? randomId();
      if (!validOperationKey(key)) throw new FinanceFailure("configuration");
    } catch (error) {
      publish({ notice: financeMessage(error) });
      return;
    }
    cancel();
    const id = version;
    controller = new AbortController();
    publish({ status: "saving", notice: "" });
    try {
      if (!pending) {
        const candidate = {
          version: 1,
          householdId,
          kind: state.kind,
          body,
          key,
          createdAt: now().getTime(),
        };
        try {
          await storage.save(JSON.stringify(candidate));
        } catch {
          throw new FinanceFailure("storage");
        }
        if (!active || id !== version) return;
        pending = candidate;
      }
      if (!active || id !== version) return;
      timer = setTimeout(() => {
        if (active && id === version) {
          cancel();
          publish({
            status: "uncertain",
            notice:
              "Não foi possível confirmar o registro. Tente novamente para verificar a mesma tentativa.",
          });
        }
      }, timeoutMs);
      const result = await spec.post(
        repository,
        householdId,
        pending.kind,
        pending.body,
        pending.key,
        controller.signal,
      );
      if (!active || id !== version) return;
      clearTimeout(timer);
      const completedKey = pending.key;
      pending = null;
      publish({
        status: "success",
        result,
        notice: "Registro salvo com sucesso.",
      });
      void storage.remove(completedKey).catch(() => {
        /* A retained key replays the same successful operation. */
      });
    } catch (error) {
      if (!active || id !== version) return;
      if (error?.code === "validation" && pending) {
        try {
          await storage.remove(pending.key);
          pending = null;
        } catch {
          /* Keep the key when cleanup cannot be confirmed. */
        }
      }
      if (error?.code === "unauthorized" || error?.code === "forbidden")
        publish({
          status: "error",
          options: null,
          notice: financeMessage(error),
        });
      else
        publish({
          status: pending ? "uncertain" : "ready",
          notice: pending
            ? "Não foi possível confirmar o registro. Tente novamente para verificar a mesma tentativa."
            : financeMessage(error),
        });
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
      void load();
      return () => {
        active = false;
        cancel();
      };
    },
    retry() {
      if (active) void load();
    },
    edit(field, value) {
      if (state.status !== "ready" || !Object.hasOwn(state.fields, field))
        return;
      const fields = { ...state.fields, [field]: value };
      if (field === "accountId") fields.destinationId = "";
      publish({ fields, notice: "" });
    },
    submit,
  };
}

export function dashboardSetupState(home) {
  if (!home || !Array.isArray(home.setupAccounts)) return "active";
  if (home.setupAccounts.length === 0 && home.accounts.length === 0)
    return "no-accounts";
  if (
    home.setupAccounts.length > 0 &&
    home.hasFinancialActivity === false &&
    home.isReconciled &&
    !home.transactions.some(
      (row) => row.kind.toLowerCase() !== "openingbalance",
    )
  )
    return "no-movements";
  return "active";
}

function localRecordDate(today) {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}
function restoreRecord(body) {
  const amount = integer(body.amountCents);
  if (amount <= 0) throw new FinanceFailure("pending");
  currency(body.currency);
  rangePeriod(body.occurredOn, body.occurredOn);
  const cents = BigInt(amount);
  return {
    accountId: body.accountId ?? body.sourceAccountId ?? "",
    destinationId: body.destinationAccountId ?? "",
    categoryId: body.categoryId ?? "",
    sourceId: body.incomeSourceId ?? "",
    amount: `${cents / 100n},${String(cents % 100n).padStart(2, "0")}`,
    date: body.occurredOn,
    description: body.description ?? "",
  };
}
const recordWriteSpec = {
  kinds: ["income", "expense", "transfer"],
  initialFields: (today) => ({
    accountId: "",
    destinationId: "",
    categoryId: "",
    sourceId: "",
    amount: "",
    date: localRecordDate(today),
    description: "",
  }),
  initialize: (fields, options, code) => ({
    ...fields,
    accountId:
      (
        options.accounts.find((row) => row.id === fields.accountId) ??
        options.accounts.find((row) => row.currency === code) ??
        options.accounts[0]
      )?.id ?? "",
  }),
  restore: restoreRecord,
  options: (repository, household, signal) =>
    repository.recordOptions(household, signal),
  prepare: (kind, fields, options) => prepareRecord(kind, fields, options),
  post: (repository, household, kind, body, key, signal) =>
    repository.postRecord(household, kind, body, key, signal),
};
export function createRecordStore(repository, household, kind, code, options) {
  return createWriteStore(repository, household, kind, code, {
    ...options,
    spec: recordWriteSpec,
  });
}
export function initialAccountAmount(value) {
  if (
    typeof value !== "string" ||
    !/^-?\d{1,16}([,.]\d{1,2})?$/.test(value.trim())
  )
    throw new FinanceFailure("validation");
  const clean = value.trim(),
    negative = clean.startsWith("-"),
    [whole, fraction = ""] = (negative ? clean.slice(1) : clean)
      .replace(",", ".")
      .split(".");
  const cents =
      (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"))) *
      (negative ? -1n : 1n),
    amount = Number(cents);
  if (!Number.isSafeInteger(amount)) throw new FinanceFailure("validation");
  return amount;
}
export function prepareAccount(fields, id) {
  const name = string(fields.name).trim(),
    kind = string(fields.kind);
  if (
    !name ||
    name.length > 80 ||
    !["cash", "checking", "savings", "investment", "other"].includes(kind) ||
    !validOperationKey(id)
  )
    throw new FinanceFailure("validation");
  let accountCurrency;
  try {
    accountCurrency = currency(string(fields.currency).trim().toUpperCase());
    rangePeriod(fields.date, fields.date);
  } catch {
    throw new FinanceFailure("validation");
  }
  return {
    id: id.toLowerCase(),
    name,
    kind,
    currency: accountCurrency,
    initialBalanceCents: initialAccountAmount(fields.balance),
    openingDate: fields.date,
  };
}
function restoreAccount(body) {
  const cents = BigInt(integer(body.initialBalanceCents)),
    absolute = cents < 0n ? -cents : cents;
  const fields = {
    name: body.name,
    kind: body.kind,
    currency: body.currency,
    balance: `${cents < 0n ? "-" : ""}${absolute / 100n},${String(absolute % 100n).padStart(2, "0")}`,
    date: body.openingDate,
  };
  prepareAccount(fields, body.id);
  return fields;
}
const accountWriteSpec = {
  kinds: ["account"],
  initialFields: (today, code) => ({
    name: "",
    kind: "checking",
    currency: code || "BRL",
    balance: "0,00",
    date: localRecordDate(today),
  }),
  initialize: (fields) => fields,
  restore: restoreAccount,
  options: (repository, household, signal) =>
    repository.accountOptions(household, signal),
  prepare: (kind, fields, options, randomId) =>
    prepareAccount(fields, randomId()),
  post: (repository, household, kind, body, key, signal) =>
    repository.createAccount(household, body, key, signal),
};
export function createAccountStore(repository, household, code, options) {
  return createWriteStore(repository, household, "account", code, {
    ...options,
    spec: accountWriteSpec,
  });
}

export function historyKind(item) {
  return (
    {
      income: "Entrada",
      expense: "Saída",
      transfer: "Transferência",
      reversal: "Estorno",
      openingbalance: "Saldo inicial",
    }[item.kind] ?? item.kind
  );
}

export function historyDraft(period, filters, catalog) {
  const bounds = parsePeriod(period);
  const category = catalog.categories.find((c) => c.id === filters.categoryId);
  return {
    ...filters,
    from: bounds.from,
    to: bounds.to,
    parentId: category?.parentId ?? filters.categoryId ?? "",
    subcategoryId: category?.parentId ? category.id : "",
  };
}
export function applyHistoryDraft(draft) {
  const period = rangePeriod(draft.from, draft.to);
  const filters = {
    search: (draft.search ?? "").trim(),
    kind: draft.kind ?? "",
    accountId: draft.accountId ?? "",
    categoryId: draft.subcategoryId || draft.parentId || "",
    includeSubcategories: !!draft.parentId && !draft.subcategoryId,
    incomeSourceId: draft.kind === "income" ? (draft.incomeSourceId ?? "") : "",
  };
  return { period, filters };
}

export function selectorSearch(items, query) {
  const normalize = (value) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  const term = normalize(query.trim());
  return items.filter((item) =>
    normalize(`${item.name} ${item.detail ?? ""}`).includes(term),
  );
}
export function calendarMonth(month, delta) {
  parsePeriod(month);
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  const result = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  parsePeriod(result);
  return result;
}
export function createAuxiliaryStore(
  repository,
  household,
  kind,
  flow,
  parentId,
  currency,
  options,
) {
  const initialFields = (today) => ({
    name: "",
    currency: currency || "BRL",
    accountKind: "checking",
    flow: flow || "expense",
    parentId: parentId || "",
    date: localRecordDate(today),
  });
  const restore = (body) => {
    if (
      !body ||
      !validOperationKey(body.id) ||
      typeof body.name !== "string" ||
      !body.name.trim() ||
      body.name.length > 80
    )
      throw new FinanceFailure("pending");
    if (kind === "account") {
      if (body.initialBalanceCents !== 0) throw new FinanceFailure("pending");
      prepareAccount(
        {
          name: body.name,
          currency: body.currency,
          kind: body.kind,
          balance: "0",
          date: body.openingDate,
        },
        body.id,
      );
    }
    if (
      kind === "category" &&
      (!["income", "expense"].includes(body.flow) ||
        body.flow !== flow ||
        (body.parentId ?? "") !== (parentId || ""))
    )
      throw new FinanceFailure("pending");
    return {
      name: body.name,
      currency: body.currency || currency || "BRL",
      accountKind: body.kind || "checking",
      flow: body.flow || flow || "expense",
      parentId: body.parentId || "",
      date: body.openingDate || localRecordDate(new Date()),
    };
  };
  return createWriteStore(repository, household, kind, currency, {
    ...options,
    spec: {
      kinds: [kind],
      initialFields,
      initialize: (fields) => fields,
      restore,
      options: (repo, id, signal) => repo.recordOptions(id, signal),
      prepare: (target, fields, catalog, randomId) => {
        const id = randomId();
        if (!validOperationKey(id)) throw new FinanceFailure("validation");
        if (target === "account")
          return prepareAccount(
            {
              name: fields.name,
              currency: fields.currency,
              kind: fields.accountKind,
              balance: "0",
              date: fields.date,
            },
            id,
          );
        const name = fields.name.trim();
        if (!name || name.length > 80) throw new FinanceFailure("validation");
        if (target === "source") return { id, name };
        if (!["income", "expense"].includes(fields.flow))
          throw new FinanceFailure("validation");
        if (
          fields.parentId &&
          !catalog.categories.some(
            (c) =>
              c.id === fields.parentId && !c.parentId && c.flow === fields.flow,
          )
        )
          throw new FinanceFailure("validation");
        return {
          id,
          name,
          flow: fields.flow,
          parentId: fields.parentId || null,
        };
      },
      post: (repo, id, target, body, key, signal) =>
        repo.createAuxiliary(id, target, body, key, signal),
    },
  });
}

export function recordReview(kind, fields, options) {
  const body = prepareRecord(kind, fields, options);
  const account = options.accounts.find((a) => a.id === fields.accountId);
  const category = options.categories.find((c) => c.id === fields.categoryId);
  const parent = options.categories.find((c) => c.id === category?.parentId);
  const rows = [
    {
      field: "accountId",
      label: kind === "income" ? "Conta de destino" : "Conta de origem",
      value: account.name,
    },
    ...(kind === "transfer"
      ? [
          {
            field: "destinationId",
            label: "Conta de destino",
            value: options.accounts.find((a) => a.id === fields.destinationId)
              .name,
          },
        ]
      : []),
    { field: null, label: "Moeda", value: account.currency },
    ...(kind !== "transfer"
      ? [
          {
            field: "categoryId",
            label: "Categoria",
            value: parent?.name ?? category.name,
          },
          ...(parent
            ? [
                {
                  field: "categoryId",
                  label: "Subcategoria",
                  value: category.name,
                },
              ]
            : []),
        ]
      : []),
    ...(kind === "income"
      ? [
          {
            field: "sourceId",
            label: "Fonte de renda",
            value:
              options.sources.find((s) => s.id === fields.sourceId)?.name ??
              "Sem fonte",
          },
        ]
      : []),
    { field: "date", label: "Data", value: displayDate(fields.date) },
    {
      field: "description",
      label: "Descrição",
      value: body.description ?? "Sem descrição",
    },
  ];
  return { amount: body.amountCents, currency: account.currency, rows };
}
