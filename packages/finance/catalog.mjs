import {
  createFinanceRepository,
  FinanceFailure,
  financeMessage,
} from "./index.mjs";
const kinds = ["categories", "sources"];
export function categoryParentChoices(categories, flow) {
  return categories.filter(
    (c) => !c.archivedAt && !c.parentId && c.flow === flow,
  );
}
export function canArchiveCategory(categories, id) {
  return !categories.some((c) => c.parentId === id && !c.archivedAt);
}
export function createCatalogRepository(options) {
  const finance = createFinanceRepository(options);
  async function request(household, resource, id, signal) {
    let base;
    try {
      base = new URL(options.baseUrl);
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
    const token = await options.getToken();
    if (!token) throw new FinanceFailure("unauthorized");
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, 15000);
    let response;
    try {
      response = await (options.fetcher ?? fetch)(
        `${base.href.replace(/\/$/, "")}/api/v1/households/${encodeURIComponent(household)}/ledger/${resource}${id ? `/${encodeURIComponent(id)}` : "?includeArchived=true"}`,
        {
          method: id ? "DELETE" : "GET",
          signal: controller.signal,
          cache: "no-store",
          redirect: "error",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
    } catch {
      throw new FinanceFailure("network");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
    if (!response.ok) {
      let problem;
      try {
        problem = await response.json();
      } catch {}
      if (problem?.code === "category_has_active_children")
        throw new FinanceFailure("category_children");
      throw new FinanceFailure(
        response.status === 401
          ? "unauthorized"
          : response.status === 403
            ? "forbidden"
            : [400, 409, 422].includes(response.status)
              ? "validation"
              : "server",
      );
    }
    if (id) return;
    try {
      return await response.json();
    } catch {
      throw new FinanceFailure("invalid");
    }
  }
  return {
    async list(household, parentSignal) {
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (parentSignal?.aborted) controller.abort();
      parentSignal?.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(abort, 15000);
      const signal = controller.signal;
      try {
        const homes = await finance.households(signal);
        if (!homes.some((h) => h.id === household))
          throw new FinanceFailure("forbidden");
        const rows = await Promise.all(
          ["categories", "income-sources", "accounts"].map((r) =>
            request(household, r, null, signal),
          ),
        );
        const [categories, sources] = rows.slice(0, 2).map((list, index) => {
          if (!Array.isArray(list)) throw new FinanceFailure("invalid");
          return list.map((row) => {
            if (
              !row ||
              typeof row.id !== "string" ||
              typeof row.name !== "string" ||
              (row.archivedAt != null &&
                !Number.isFinite(Date.parse(row.archivedAt)))
            )
              throw new FinanceFailure("invalid");
            const common = {
              id: row.id,
              name: row.name,
              archivedAt: row.archivedAt ?? null,
            };
            if (index) return common;
            const flow = String(row.flow).toLowerCase();
            if (
              !["income", "expense"].includes(flow) ||
              (row.parentId != null && typeof row.parentId !== "string")
            )
              throw new FinanceFailure("invalid");
            return { ...common, flow, parentId: row.parentId ?? null };
          });
        });
        if (
          !Array.isArray(rows[2]) ||
          rows[2].some((row) => !row || !/^[A-Z]{3}$/.test(row.currency))
        )
          throw new FinanceFailure("invalid");
        const currencies = [
          ...new Set(rows[2].map((row) => row.currency)),
        ].sort();
        return { categories, sources, currencies };
      } finally {
        clearTimeout(timer);
        parentSignal?.removeEventListener("abort", abort);
      }
    },
    async create(household, pending) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        return await (pending.type === "categories"
          ? finance.createCategory(
              household,
              pending.body,
              pending.key,
              controller.signal,
            )
          : finance.createIncomeSource(
              household,
              pending.body,
              pending.key,
              controller.signal,
            ));
      } finally {
        clearTimeout(timer);
      }
    },
    async archive(household, type, id) {
      if (!kinds.includes(type) || !id) throw new FinanceFailure("validation");
      await request(
        household,
        type === "categories" ? "categories" : "income-sources",
        id,
      );
    },
  };
}
export function createCatalogStore(
  repository,
  household,
  { storage, randomId },
) {
  let state = {
    currencies: [],
    categories: [],
    sources: [],
    loading: true,
    busy: false,
    error: "",
    notice: "",
    pending: null,
  };
  let active = false,
    generation = 0,
    controller,
    locked = false;
  const listeners = new Set();
  const emit = (patch) => {
    if (active) {
      state = { ...state, ...patch };
      listeners.forEach((fn) => fn());
    }
  };
  const message = (error) =>
    error?.code === "category_children"
      ? "Arquive as subcategorias ativas antes de arquivar a categoria principal."
      : error instanceof FinanceFailure
        ? financeMessage(error)
        : "Não foi possível concluir. Atualize os dados e tente novamente.";
  function parsePending(raw) {
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (
      !kinds.includes(value.type) ||
      typeof value.key !== "string" ||
      !value.body ||
      typeof value.body.name !== "string" ||
      (value.type === "categories" &&
        !["income", "expense"].includes(value.body.flow))
    )
      throw new FinanceFailure("invalid");
    return value;
  }
  async function load() {
    const token = ++generation;
    controller?.abort();
    controller = new AbortController();
    emit({ loading: true, error: "" });
    try {
      const pending = parsePending(await storage.load());
      const data = await repository.list(household, controller.signal);
      if (!active || token !== generation) return;
      if (pending && data[pending.type].some((row) => row.id === pending.key)) {
        await storage.remove(pending.key);
        if (!active || token !== generation) return;
        emit({
          ...data,
          pending: null,
          loading: false,
          notice: "Cadastro confirmado e recuperado.",
        });
      } else emit({ ...data, pending, loading: false });
    } catch (error) {
      if (active && token === generation)
        emit({ loading: false, error: message(error) });
    }
  }
  async function send(pending) {
    await storage.save(JSON.stringify(pending));
    emit({ pending });
    // Reconcile the same identifier before replay, including sources without a replay endpoint.
    const data = await repository.list(household);
    if (!data[pending.type].some((row) => row.id === pending.key)) {
      try {
        await repository.create(household, pending);
      } catch (error) {
        if (
          error instanceof FinanceFailure &&
          ["validation", "catalog_conflict"].includes(error.code)
        ) {
          await storage.remove(pending.key);
          emit({ pending: null });
        }
        throw error;
      }
    }
    await storage.remove(pending.key);
    emit({
      pending: null,
      notice: "Cadastro salvo. Seu Ninho está mais organizado.",
    });
    await load();
  }
  async function run(action) {
    if (locked || !active || state.loading || state.error) return false;
    locked = true;
    emit({ busy: true, notice: "" });
    try {
      await action();
      return true;
    } catch (error) {
      emit({
        notice: `Não foi possível confirmar a operação. Atualize para verificar o resultado. ${message(error)}`,
      });
      return false;
    } finally {
      locked = false;
      emit({ busy: false });
    }
  }
  return {
    getSnapshot: () => state,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    start() {
      active = true;
      void load();
      return () => {
        active = false;
        generation++;
        controller?.abort();
      };
    },
    retry: () => {
      if (!locked) void load();
    },
    create: (type, body) =>
      run(async () => {
        if (
          state.pending ||
          !kinds.includes(type) ||
          !body.name?.trim() ||
          body.name.trim().length > 80
        )
          throw new FinanceFailure("validation");
        if (
          type === "categories" &&
          (!["income", "expense"].includes(body.flow) ||
            (body.parentId &&
              !categoryParentChoices(state.categories, body.flow).some(
                (c) => c.id === body.parentId,
              )))
        )
          throw new FinanceFailure("validation");
        await send({
          type,
          key: randomId(),
          body: {
            name: body.name.trim(),
            ...(type === "categories"
              ? { flow: body.flow, parentId: body.parentId || null }
              : {}),
          },
        });
      }),
    recover: () =>
      run(async () => {
        if (state.pending) await send(state.pending);
      }),
    archive: (type, id) =>
      run(async () => {
        const item = state[type]?.find((row) => row.id === id);
        if (!item || item.archivedAt) throw new FinanceFailure("validation");
        if (
          type === "categories" &&
          !canArchiveCategory(state.categories, id)
        ) {
          emit({ notice: "Arquive as subcategorias ativas primeiro." });
          return;
        }
        await repository.archive(household, type, id);
        emit({
          notice:
            "Arquivada. Os lançamentos e sua identificação foram preservados.",
        });
        await load();
      }),
  };
}
