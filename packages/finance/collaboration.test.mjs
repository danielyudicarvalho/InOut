import test from "node:test";
import assert from "node:assert/strict";
import {
  createCollaborationRepository,
  createCollaborationStore,
  createHouseholdAccessStore,
  CollaborationFailure,
  lastOwner,
  invitationStatus,
} from "./collaboration.mjs";
const now = "2026-11-05T12:00:00Z";
const owner = { userId: "owner-id", role: "owner", joinedAt: now },
  member = { userId: "member-id", role: "member", joinedAt: now };
const context = {
  id: "h",
  name: "Nosso lar",
  actorId: "owner-id",
  role: "owner",
  maximumMembers: 2,
  members: [owner, member],
};
const tick = () => new Promise((r) => setImmediate(r));
async function ready(store) {
  for (let i = 0; i < 40; i++) {
    await tick();
    if (
      !store.getSnapshot().loading &&
      store.getSnapshot().status !== "loading"
    )
      return;
  }
  throw Error("not settled");
}
test("single responsible is protected and invitation status distinguishes used revoked expired and pending", () => {
  assert.equal(lastOwner(context, owner), true);
  assert.equal(
    lastOwner(
      { ...context, members: [owner, { ...member, role: "owner" }] },
      owner,
    ),
    false,
  );
  const invitation = { expiresAt: "2026-11-06T12:00:00Z" };
  assert.equal(invitationStatus(invitation, Date.parse(now)), "Pendente");
  assert.equal(
    invitationStatus({ ...invitation, revokedAt: now }, Date.parse(now)),
    "Revogado",
  );
  assert.equal(
    invitationStatus({ ...invitation, acceptedAt: now }, Date.parse(now)),
    "Aceito",
  );
  assert.equal(
    invitationStatus(invitation, Date.parse("2026-11-07")),
    "Expirado",
  );
});
test("repository uses authenticated management contracts and never returns stored token hashes", async () => {
  const calls = [];
  const repo = createCollaborationRepository({
    baseUrl: "https://api.example",
    getToken: async () => "token",
    fetcher: async (url, init) => {
      calls.push({ url, init });
      if (init.method !== "GET") return new Response(null, { status: 204 });
      return Response.json(
        url.endsWith("/context")
          ? context
          : [
              {
                id: "i",
                createdAt: now,
                expiresAt: now,
                tokenHash: "must-not-expose",
              },
            ],
      );
    },
  });
  assert.equal((await repo.context("h")).role, "owner");
  const invites = await repo.invitations("h");
  assert.equal(invites[0].tokenHash, undefined);
  await repo.changeRole("h", "member-id", "owner");
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { role: "owner" });
  assert.ok(calls.at(-1).url.endsWith("/members/member-id/role"));
  await repo.remove("h", "member-id");
  assert.equal(calls.at(-1).init.method, "DELETE");
  await repo.leave("h");
  assert.ok(calls.at(-1).url.endsWith("/leave"));
  await repo.revoke("h", "i");
  assert.ok(calls.at(-1).url.endsWith("/invitations/i"));
  assert.equal(calls.at(-1).init.headers.Authorization, "Bearer token");
});
test("unauthorized and invalid roles fail without writes and domain rejection is preserved", async () => {
  let writes = 0;
  const repo = createCollaborationRepository({
    baseUrl: "https://api.example",
    getToken: async () => "token",
    fetcher: async () => {
      writes++;
      return Response.json({ code: "last_household_owner" }, { status: 409 });
    },
  });
  assert.throws(
    () => repo.changeRole("h", "m", "admin"),
    (e) => e.code === "invalid_household_role",
  );
  assert.equal(writes, 0);
  await assert.rejects(
    repo.leave("h"),
    (e) => e.code === "last_household_owner",
  );
  const denied = createCollaborationRepository({
    baseUrl: "https://api.example",
    getToken: async () => null,
    fetcher: () => {
      throw Error("called");
    },
  });
  await assert.rejects(denied.homes(), (e) => e.code === "unauthorized");
});
function harness({
  homes = [{ id: "h", name: "Lar" }],
  ctx = context,
  invites = [],
} = {}) {
  const calls = [];
  let rejected = false;
  const repo = {
    homes: async () => homes,
    context: async () => {
      if (rejected) throw new CollaborationFailure("membership_required");
      return ctx;
    },
    invitations: async () => invites,
    invite: async () => ({
      code: "a".repeat(48),
      expiresAt: "2099-11-06T12:00:00Z",
    }),
    changeRole: async (...args) => {
      calls.push(args);
    },
    remove: async () => {
      calls.push("remove");
    },
    leave: async () => {
      rejected = true;
    },
    revoke: async () => {
      calls.push("revoke");
    },
  };
  const store = createCollaborationStore(repo, "h");
  const stop = store.start();
  return {
    store,
    stop,
    calls,
    repo,
    setHomes: (v) => {
      homes = v;
    },
    setContext: (v) => {
      ctx = v;
    },
  };
}
test("unknown requested household is removed rather than silently loading another home", async () => {
  const h = harness({ homes: [{ id: "other", name: "Outro" }] });
  await ready(h.store);
  assert.equal(h.store.getSnapshot().status, "removed");
  assert.equal(h.store.getSnapshot().context, null);
  h.stop();
});
test("member view never requests owner-only invitation metadata and switching contexts clears previous data", async () => {
  const h = harness({
    ctx: { ...context, actorId: "member-id", role: "member" },
  });
  h.repo.invitations = async () => {
    throw Error("must not request");
  };
  await ready(h.store);
  assert.equal(h.store.getSnapshot().status, "ready");
  assert.deepEqual(h.store.getSnapshot().invitations, []);
  h.store.select("other");
  assert.equal(h.store.getSnapshot().context, null);
  await ready(h.store);
  assert.equal(h.store.getSnapshot().status, "removed");
  h.stop();
});
test("successful leave clears the full household context; writes cannot be repeated from removed state", async () => {
  const h = harness();
  await ready(h.store);
  assert.equal(await h.store.leave(), true);
  assert.equal(h.store.getSnapshot().status, "removed");
  assert.equal(h.store.getSnapshot().context, null);
  assert.equal(await h.store.remove("m"), false);
  h.stop();
});
test("duplicate in-flight writes are locked and stale reads cannot restore a closed store", async () => {
  const h = harness();
  await ready(h.store);
  let resolve;
  h.repo.changeRole = () =>
    new Promise((r) => {
      resolve = r;
    });
  const first = h.store.role("member-id", "owner");
  assert.equal(await h.store.role("member-id", "owner"), false);
  h.stop();
  resolve();
  assert.equal(await first, false);
});
test("access guard closes the view after revocation and does not restore it from another context", async () => {
  let homes = [{ id: "h", name: "Lar" }];
  const store = createHouseholdAccessStore({ homes: async () => homes }, "h");
  const stop = store.start();
  await ready(store);
  assert.equal(store.getSnapshot().status, "authorized");
  homes = [];
  store.retry();
  await tick();
  assert.equal(store.getSnapshot().status, "removed");
  homes = [{ id: "h", name: "Lar" }];
  store.retry();
  await tick();
  assert.equal(store.getSnapshot().status, "removed");
  stop();
});
test("access guard clears view when a previously visible membership disappears without an explicit query ID", async () => {
  let homes = [{ id: "h", name: "Lar" }];
  const store = createHouseholdAccessStore({ homes: async () => homes });
  const stop = store.start();
  await ready(store);
  homes = [];
  store.retry();
  await tick();
  assert.equal(store.getSnapshot().status, "removed");
  stop();
});
test("acceptance sends the actual normalized 48-character code, never demo data", async () => {
  let body;
  const repo = createCollaborationRepository({
    baseUrl: "https://api.example",
    getToken: async () => "token",
    fetcher: async (url, init) => {
      assert.ok(url.endsWith("/household-invitations/accept"));
      body = JSON.parse(init.body);
      return Response.json({ id: "h", name: "Lar" });
    },
  });
  assert.throws(
    () => repo.accept("NINHO-7K2M"),
    (e) => e.code === "invalid_invite",
  );
  await repo.accept(" " + "A".repeat(48) + " ");
  assert.equal(body.code, "a".repeat(48));
});
test("invitation code is only retained for a still pending invitation and cleared after role loss", async () => {
  const expiresAt = "2099-11-06T12:00:00Z";
  const h = harness({
    invites: [
      { id: "i", createdAt: now, expiresAt, acceptedAt: null, revokedAt: null },
    ],
  });
  await ready(h.store);
  assert.equal(await h.store.invite(), true);
  assert.equal(h.store.getSnapshot().code.code, "a".repeat(48));
  h.setContext({ ...context, actorId: "member-id", role: "member" });
  h.store.retry();
  assert.equal(h.store.getSnapshot().code, null);
  await ready(h.store);
  assert.equal(h.store.getSnapshot().code, null);
  assert.deepEqual(h.store.getSnapshot().invitations, []);
  h.stop();
});
