import test from "node:test";
import assert from "node:assert/strict";
import { AuthFailure } from "./index.mjs";
import { createSessionRestorer } from "./session.mjs";
const user = { id: "u", email: "user@example.com", emailConfirmed: true };
function fixture(currentUser, options) {
  let event;
  let cleaned = false;
  let calls = 0;
  const restorer = createSessionRestorer(
    () => ({
      currentUser: () => {
        calls++;
        return currentUser();
      },
      subscribe: (listener) => {
        event = listener;
        return () => {
          cleaned = true;
        };
      },
    }),
    options,
  );
  return {
    restorer,
    emit: () => event(),
    get cleaned() {
      return cleaned;
    },
    get calls() {
      return calls;
    },
  };
}
test("startup validates identity and restores confirmed access", async () => {
  const f = fixture(async () => user);
  const stop = f.restorer.start();
  await f.restorer.restore();
  assert.deepEqual(f.restorer.getSnapshot(), {
    status: "authenticated",
    user,
    notice: "",
  });
  assert.equal(f.calls, 1);
  stop();
  assert.equal(f.cleaned, true);
});
test("missing, unconfirmed and revoked identities never expose authenticated content", async () => {
  for (const [value, status] of [
    [null, "expired"],
    [{ ...user, emailConfirmed: false }, "confirmationRequired"],
  ]) {
    const f = fixture(async () => value);
    const stop = f.restorer.start();
    await f.restorer.restore();
    assert.equal(f.restorer.getSnapshot().status, status);
    assert.equal(f.restorer.getSnapshot().user, null);
    stop();
  }
  const f = fixture(async () => {
    throw new AuthFailure("refresh_token_not_found");
  });
  const stop = f.restorer.start();
  await f.restorer.restore();
  assert.equal(f.restorer.getSnapshot().status, "expired");
  stop();
});
test("network failure retains retry and never reports expired session", async () => {
  let online = false;
  const f = fixture(async () => {
    if (!online) throw new TypeError("private transport detail");
    return user;
  });
  const stop = f.restorer.start();
  await f.restorer.restore();
  assert.equal(f.restorer.getSnapshot().status, "error");
  assert.equal(f.restorer.getSnapshot().user, null);
  assert.ok(!f.restorer.getSnapshot().notice.includes("private"));
  online = true;
  await f.restorer.restore();
  assert.equal(f.restorer.getSnapshot().status, "authenticated");
  stop();
});
test("hung request times out and its late response cannot restore access", async () => {
  let resolve;
  const f = fixture(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
    { timeoutMs: 5 },
  );
  const stop = f.restorer.start();
  await f.restorer.restore();
  assert.equal(f.restorer.getSnapshot().status, "error");
  resolve(user);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(f.restorer.getSnapshot().status, "error");
  stop();
});
test("auth change immediately hides content and revalidates before restoring", async () => {
  let value = user;
  const f = fixture(async () => value);
  const stop = f.restorer.start();
  await f.restorer.restore();
  value = null;
  f.emit();
  assert.equal(f.restorer.getSnapshot().status, "loading");
  assert.equal(f.restorer.getSnapshot().user, null);
  await f.restorer.restore();
  assert.equal(f.restorer.getSnapshot().status, "expired");
  stop();
});
test("stale in-flight identity cannot override a later signout result", async () => {
  let resolve;
  let first = true;
  const f = fixture(() =>
    first
      ? ((first = false),
        new Promise((r) => {
          resolve = r;
        }))
      : Promise.resolve(null),
  );
  const stop = f.restorer.start();
  await Promise.resolve();
  f.emit();
  await f.restorer.restore();
  resolve(user);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(f.restorer.getSnapshot().status, "expired");
  stop();
});
test("duplicate retries share work and unmount invalidates pending responses", async () => {
  let resolve;
  const f = fixture(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const stop = f.restorer.start();
  const a = f.restorer.restore(),
    b = f.restorer.restore();
  assert.equal(a, b);
  await Promise.resolve();
  assert.equal(f.calls, 1);
  stop();
  resolve(user);
  await a;
  await Promise.resolve();
  assert.notEqual(f.restorer.getSnapshot().status, "authenticated");
  assert.equal(f.cleaned, true);
});
test("missing configuration becomes recoverable error without exposing a user", async () => {
  const store = createSessionRestorer(() => {
    throw new AuthFailure("configuration");
  });
  const stop = store.start();
  await store.restore();
  assert.equal(store.getSnapshot().status, "error");
  assert.match(store.getSnapshot().notice, /configurada/);
  stop();
});

test("mount cleanup and restart do not issue a stale provider request", async () => {
  const f = fixture(async () => user);
  const stopFirst = f.restorer.start();
  stopFirst();
  const stopSecond = f.restorer.start();
  await f.restorer.restore();
  assert.equal(f.calls, 1);
  assert.equal(f.restorer.getSnapshot().status, "authenticated");
  stopSecond();
});
