import { AuthFailure, authMessage } from "./index.mjs";
const expiredCodes = new Set([
  "session_missing",
  "session_not_found",
  "session_expired",
  "refresh_token_not_found",
  "refresh_token_already_used",
  "bad_jwt",
  "jwt_expired",
  "user_not_found",
]);
/** Application state machine. No SDK, router, UI or token storage dependencies. */
export function createSessionRestorer(getAuth, { timeoutMs = 15000 } = {}) {
  let snapshot = { status: "loading", user: null, notice: "" };
  const listeners = new Set();
  let active = false;
  let generation = 0;
  let pending = null;
  let cancelPending = () => {};
  let unsubscribe = () => {};
  let scheduled = false;
  const publish = (next) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  function restore() {
    if (!active) return Promise.resolve();
    if (pending) return pending;
    const id = ++generation;
    publish({ status: "loading", user: null, notice: "" });
    let resolveRequest;
    const request = new Promise((resolve) => {
      resolveRequest = resolve;
    });
    pending = request;
    let timer;
    let settled = false;
    const finish = (next) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (active && id === generation) {
        pending = null;
        publish(next);
      }
      resolveRequest();
    };
    cancelPending = () => {
      settled = true;
      clearTimeout(timer);
      pending = null;
      resolveRequest();
    };
    timer = setTimeout(
      () =>
        finish({
          status: "error",
          user: null,
          notice:
            "A verificação demorou mais que o esperado. Confira sua conexão e tente novamente.",
        }),
      timeoutMs,
    );
    Promise.resolve()
      .then(() =>
        !active || id !== generation ? null : getAuth().currentUser(),
      )
      .then((user) => {
        if (!user) finish({ status: "expired", user: null, notice: "" });
        else if (!user.emailConfirmed)
          finish({ status: "confirmationRequired", user: null, notice: "" });
        else finish({ status: "authenticated", user, notice: "" });
      })
      .catch((error) =>
        finish({
          status:
            error instanceof AuthFailure && expiredCodes.has(error.code)
              ? "expired"
              : "error",
          user: null,
          notice:
            error instanceof AuthFailure && expiredCodes.has(error.code)
              ? ""
              : authMessage(error),
        }),
      );
    return request;
  }
  function invalidate() {
    if (!active) return;
    generation++;
    cancelPending();
    publish({ status: "loading", user: null, notice: "" });
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (active) void restore();
    });
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    restore,
    start() {
      active = true;
      try {
        unsubscribe = getAuth().subscribe(invalidate);
      } catch {
        /* restore maps missing configuration and provider failures. */
      }
      void restore();
      return () => {
        active = false;
        generation++;
        cancelPending();
        unsubscribe();
      };
    },
  };
}
