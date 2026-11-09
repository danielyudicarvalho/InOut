export class CollaborationFailure extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
export function collaborationMessage(error) {
  return (
    {
      last_household_owner:
        "Promova outro participante a responsável antes de continuar. O último responsável não pode sair nem perder o papel.",
      owner_required:
        "Somente um responsável pode gerenciar membros e convites.",
      household_full: "A residência já tem dois participantes.",
      household_member_not_found:
        "O participante não está mais nesta residência. Atualize os dados.",
      already_member: "Você já participa desta residência.",
      invalid_invite: "O convite é inválido, expirou, foi usado ou revogado.",
      invalid_household_role: "Escolha um papel válido.",
      membership_required: "Seu acesso a esta residência foi encerrado.",
      unauthorized: "Entre novamente para continuar.",
      configuration: "Configure o endereço do backend.",
      network:
        "Não foi possível confirmar a resposta. Atualize para verificar antes de tentar novamente.",
      invalid:
        "O servidor retornou dados inesperados. Atualize e tente novamente.",
    }[error?.code] ??
    "Não foi possível concluir. Atualize os dados e tente novamente."
  );
}
export function invitationStatus(item, now = Date.now()) {
  return item.acceptedAt
    ? "Aceito"
    : item.revokedAt
      ? "Revogado"
      : Date.parse(item.expiresAt) <= now
        ? "Expirado"
        : "Pendente";
}
export function roleLabel(role) {
  return role === "owner" ? "Responsável" : "Membro";
}
export function memberLabel(member, actorId) {
  return member.userId === actorId
    ? "Você"
    : `Participante ${member.userId.slice(0, 8)}`;
}
export function lastOwner(context, member) {
  return (
    member.role === "owner" &&
    context.members.filter((m) => m.role === "owner").length === 1
  );
}
export function createCollaborationRepository({
  baseUrl,
  getToken,
  fetcher = fetch,
}) {
  async function request(path, method = "GET", body, signal) {
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
      throw new CollaborationFailure("configuration");
    }
    const token = await getToken();
    if (!token) throw new CollaborationFailure("unauthorized");
    const controller = new AbortController(),
      abort = () => controller.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, 15000);
    try {
      const response = await fetcher(`${base.href.replace(/\/$/, "")}${path}`, {
        method,
        signal: controller.signal,
        cache: "no-store",
        redirect: "error",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        let problem;
        try {
          problem = await response.json();
        } catch {}
        throw new CollaborationFailure(
          response.status === 401
            ? "unauthorized"
            : response.status === 403
              ? problem?.code === "owner_required"
                ? "owner_required"
                : "membership_required"
              : (problem?.code ?? "server"),
        );
      }
      if (response.status === 204) return null;
      try {
        return await response.json();
      } catch {
        throw new CollaborationFailure("invalid");
      }
    } catch (error) {
      if (error instanceof CollaborationFailure) throw error;
      throw new CollaborationFailure("network");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
  const root = (h) => `/api/v1/households/${encodeURIComponent(h)}`;
  return {
    async homes(signal) {
      const rows = await request(
        "/api/v1/households",
        "GET",
        undefined,
        signal,
      );
      if (
        !Array.isArray(rows) ||
        rows.some(
          (r) => !r || typeof r.id !== "string" || typeof r.name !== "string",
        )
      )
        throw new CollaborationFailure("invalid");
      return rows;
    },
    async context(h, signal) {
      const raw = await request(`${root(h)}/context`, "GET", undefined, signal);
      if (
        !raw ||
        raw.id !== h ||
        typeof raw.name !== "string" ||
        typeof raw.actorId !== "string" ||
        !Array.isArray(raw.members) ||
        !Number.isSafeInteger(raw.maximumMembers)
      )
        throw new CollaborationFailure("invalid");
      const role = String(raw.role).toLowerCase();
      const members = raw.members.map((m) => {
        const r = String(m.role).toLowerCase();
        if (
          typeof m.userId !== "string" ||
          !["owner", "member"].includes(r) ||
          !Number.isFinite(Date.parse(m.joinedAt))
        )
          throw new CollaborationFailure("invalid");
        return { ...m, role: r };
      });
      if (
        !["owner", "member"].includes(role) ||
        !members.some((m) => m.userId === raw.actorId && m.role === role)
      )
        throw new CollaborationFailure("invalid");
      return { ...raw, role, members };
    },
    async invitations(h, signal) {
      const rows = await request(
        `${root(h)}/invitations`,
        "GET",
        undefined,
        signal,
      );
      if (
        !Array.isArray(rows) ||
        rows.some(
          (r) =>
            typeof r.id !== "string" ||
            !Number.isFinite(Date.parse(r.createdAt)) ||
            !Number.isFinite(Date.parse(r.expiresAt)),
        )
      )
        throw new CollaborationFailure("invalid");
      return rows.map(
        ({ id, createdAt, expiresAt, acceptedAt, revokedAt }) => ({
          id,
          createdAt,
          expiresAt,
          acceptedAt: acceptedAt ?? null,
          revokedAt: revokedAt ?? null,
        }),
      );
    },
    async invite(h) {
      const value = await request(`${root(h)}/invitations`, "POST");
      if (
        !/^[a-fA-F0-9]{48}$/.test(value?.code) ||
        !Number.isFinite(Date.parse(value.expiresAt))
      )
        throw new CollaborationFailure("invalid");
      return value;
    },
    changeRole: (h, id, role) => {
      if (!["owner", "member"].includes(role))
        throw new CollaborationFailure("invalid_household_role");
      return request(
        `${root(h)}/members/${encodeURIComponent(id)}/role`,
        "PUT",
        { role },
      );
    },
    remove: (h, id) =>
      request(`${root(h)}/members/${encodeURIComponent(id)}`, "DELETE"),
    leave: (h) => request(`${root(h)}/leave`, "POST"),
    revoke: (h, id) =>
      request(`${root(h)}/invitations/${encodeURIComponent(id)}`, "DELETE"),
    accept: (code) => {
      const normalized = code.trim().toLowerCase();
      if (!/^[a-f0-9]{48}$/.test(normalized))
        throw new CollaborationFailure("invalid_invite");
      return request("/api/v1/household-invitations/accept", "POST", {
        code: normalized,
      }).then((result) => {
        if (
          !result ||
          typeof result.id !== "string" ||
          typeof result.name !== "string"
        )
          throw new CollaborationFailure("invalid");
        return { id: result.id, name: result.name };
      });
    },
  };
}
export function createCollaborationStore(repository, initialHousehold = "") {
  let state = {
    homes: [],
    household: initialHousehold,
    context: null,
    invitations: [],
    code: null,
    loading: true,
    busy: false,
    status: "loading",
    notice: "",
  };
  let active = false,
    version = 0,
    controller,
    lock = false,
    timer;
  const listeners = new Set(),
    emit = (patch) => {
      if (active) {
        state = { ...state, ...patch };
        listeners.forEach((fn) => fn());
      }
    };
  async function load(id = state.household, quiet = false) {
    const revision = ++version;
    controller?.abort();
    controller = new AbortController();
    if (!quiet)
      emit({
        loading: true,
        context: null,
        code: null,
        status: "loading",
        notice: "",
      });
    try {
      const homes = await repository.homes(controller.signal);
      if (!active || revision !== version) return;
      if (id && !homes.some((h) => h.id === id)) {
        emit({
          homes,
          context: null,
          invitations: [],
          code: null,
          loading: false,
          status: "removed",
          notice: "",
        });
        return;
      }
      if (!id) {
        emit({
          homes,
          context: null,
          invitations: [],
          code: null,
          loading: false,
          status: "choose",
          notice: "",
        });
        return;
      }
      const context = await repository.context(id, controller.signal);
      let invitations = [];
      if (context.role === "owner")
        invitations = await repository.invitations(id, controller.signal);
      if (active && revision === version) {
        const keepCode =
          context.role === "owner" &&
          state.code &&
          invitations.some(
            (i) =>
              Date.parse(i.expiresAt) === Date.parse(state.code.expiresAt) &&
              invitationStatus(i) === "Pendente",
          );
        emit({
          homes,
          household: id,
          context,
          invitations,
          code: keepCode ? state.code : null,
          loading: false,
          status: "ready",
        });
      }
    } catch (error) {
      if (!active || revision !== version) return;
      const lost = error?.code === "membership_required";
      emit({
        context: null,
        invitations: [],
        code: null,
        loading: false,
        status: lost ? "removed" : "error",
        notice: collaborationMessage(error),
      });
    }
  }
  async function mutate(action) {
    if (lock || state.status !== "ready") return false;
    lock = true;
    version++;
    controller?.abort();
    emit({ busy: true, notice: "" });
    const scope = state.household;
    try {
      const result = await action(scope);
      if (!active) return false;
      await load(scope, true);
      if (result?.code && state.status === "ready") {
        if (
          state.invitations.some(
            (i) =>
              Date.parse(i.expiresAt) === Date.parse(result.expiresAt) &&
              invitationStatus(i) === "Pendente",
          )
        )
          emit({ code: result });
        else
          emit({
            code: null,
            notice:
              "Este convite foi substituído ou deixou de estar disponível. Atualize os convites.",
          });
      } else if (state.status === "ready")
        emit({ notice: "Alteração confirmada." });
      return true;
    } catch (error) {
      if (error?.code === "membership_required")
        emit({ context: null, invitations: [], code: null, status: "removed" });
      else emit({ notice: collaborationMessage(error) });
      return false;
    } finally {
      lock = false;
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
      timer = setInterval(() => {
        if (!lock && state.household) void load(state.household, true);
      }, 15000);
      return () => {
        active = false;
        version++;
        clearInterval(timer);
        controller?.abort();
      };
    },
    retry: () => {
      if (!lock) void load();
    },
    select: (id) => {
      if (!lock) {
        emit({ household: id });
        void load(id);
      }
    },
    invite: () => mutate((h) => repository.invite(h)),
    role: (id, role) => mutate((h) => repository.changeRole(h, id, role)),
    remove: (id) => mutate((h) => repository.remove(h, id)),
    leave: () => mutate((h) => repository.leave(h)),
    revoke: (id) => mutate((h) => repository.revoke(h, id)),
    clearCode: () => emit({ code: null }),
  };
}
// Revalidate live membership without exposing financial data. Lost access clears the view.
export function createHouseholdAccessStore(repository, household = "") {
  let state = { status: "loading", notice: "" },
    active = false,
    revision = 0,
    timer,
    controller,
    known = null;
  const listeners = new Set(),
    emit = (next) => {
      if (active) {
        state = next;
        listeners.forEach((fn) => fn());
      }
    };
  async function check() {
    const token = ++revision;
    controller?.abort();
    controller = new AbortController();
    try {
      const homes = await repository.homes(controller.signal);
      if (!active || token !== revision) return;
      const ids = homes.map((h) => h.id);
      if (
        (household && !ids.includes(household)) ||
        (!household && known?.some((id) => !ids.includes(id)))
      ) {
        emit({ status: "removed", notice: "" });
        return;
      }
      known = ids;
      emit({ status: "authorized", notice: "" });
    } catch (error) {
      if (active && token === revision)
        emit({ status: "error", notice: collaborationMessage(error) });
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
      void check();
      timer = setInterval(() => {
        if (state.status !== "removed") void check();
      }, 15000);
      return () => {
        active = false;
        revision++;
        clearInterval(timer);
        controller?.abort();
      };
    },
    retry: () => {
      if (state.status !== "removed") void check();
    },
  };
}
