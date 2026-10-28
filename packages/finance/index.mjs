export class FinanceFailure extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
export function financeMessage(error) {
  const messages = {
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
      balance: integer(row.balanceCents),
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
