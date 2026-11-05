import { FinanceFailure } from "./index.mjs";
export function groupAccounts(
  accounts,
  { archived = false, search = "" } = {},
) {
  const groups = new Map();
  for (const account of accounts) {
    if (
      Boolean(account.archivedAt) !== archived ||
      !account.name
        .toLocaleLowerCase("pt-BR")
        .includes(search.trim().toLocaleLowerCase("pt-BR"))
    )
      continue;
    const group = groups.get(account.currency) ?? {
      currency: account.currency,
      balance: 0,
      accounts: [],
    };
    group.accounts.push(account);
    group.balance += account.balance;
    if (!Number.isSafeInteger(group.balance))
      throw new FinanceFailure("invalid");
    groups.set(account.currency, group);
  }
  return [...groups.values()].sort((a, b) =>
    a.currency.localeCompare(b.currency),
  );
}
export function createAccountsRepository({
  baseUrl,
  getToken,
  fetcher = fetch,
}) {
  async function request(household, suffix = "", method = "GET", body, signal) {
    let base;
    try {
      base = new URL(baseUrl);
      if (
        !["http:", "https:"].includes(base.protocol) ||
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
    if (!token) throw new FinanceFailure("unauthorized");
    let response;
    try {
      response = await fetcher(
        `${base.href.replace(/\/$/, "")}/api/v1/households/${encodeURIComponent(household)}/ledger/accounts${suffix}`,
        {
          method,
          signal,
          redirect: "error",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
    } catch {
      throw new FinanceFailure("network");
    }
    if (!response.ok)
      throw new FinanceFailure(
        response.status === 401
          ? "unauthorized"
          : response.status === 403
            ? "forbidden"
            : response.status === 400 || response.status === 409
              ? "validation"
              : "server",
      );
    return response.status === 204 ? null : response.json();
  }
  return {
    async list(household, signal) {
      const rows = await request(
        household,
        "?includeArchived=true",
        "GET",
        undefined,
        signal,
      );
      if (!Array.isArray(rows)) throw new FinanceFailure("invalid");
      return rows.map((row) => {
        if (
          typeof row.id !== "string" ||
          typeof row.name !== "string" ||
          typeof row.kind !== "string" ||
          !/^[A-Z]{3}$/.test(row.currency) ||
          !Number.isSafeInteger(row.balanceCents) ||
          (row.archivedAt != null &&
            !Number.isFinite(Date.parse(row.archivedAt)))
        )
          throw new FinanceFailure("invalid");
        return {
          id: row.id,
          name: row.name,
          kind: row.kind,
          currency: row.currency,
          balance: row.balanceCents,
          archivedAt: row.archivedAt ?? null,
        };
      });
    },
    async edit(household, id, name, kind) {
      if (
        !name.trim() ||
        name.trim().length > 80 ||
        !["checking", "cash", "savings", "investment", "other"].includes(kind)
      )
        throw new FinanceFailure("validation");
      await request(household, `/${encodeURIComponent(id)}`, "PUT", {
        name: name.trim(),
        kind,
      });
    },
    async archive(household, id) {
      await request(household, `/${encodeURIComponent(id)}`, "DELETE");
    },
  };
}
