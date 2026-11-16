import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  openSessionId,
  sealSessionId,
  sessionKey,
  sessionKeys,
  verifyCsrf,
  verifySameOrigin,
} from "./session-cookie";

const sessionCookie = "inout_session";
const csrfCookie = "inout_csrf";

type IdentityPayload = {
  code?: string;
  ticket?: string;
  user?: { id: string; email: string; emailConfirmed: boolean };
  authenticatorKey?: string;
};

type StoredSession = {
  sessionId: string;
  csrf: string;
  purpose: string;
  user: IdentityPayload["user"] | null;
  expiresAt?: string;
  accessToken?: string | null;
  loginTicket?: string | null;
  pendingTicket?: string | null;
};

function apiBase(): string {
  const value = process.env.API_BASE_URL;
  if (!value) throw new Error("API_BASE_URL is required.");
  return value.replace(/\/$/, "");
}

function webSecret(): string {
  const value = process.env.AUTH_WEB_CLIENT_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_WEB_CLIENT_SECRET is required in production.");
  }
  return "dev-only-web-client-secret";
}

function clientIpHeaders(request?: Request): Record<string, string> {
  if (!request) return {};
  const ip =
    request.headers.get("fly-client-ip") ??
    request.headers.get("x-real-ip") ??
    "";
  const key = process.env.BFF_IP_KEY;
  if (!ip || !key) return {};
  return {
    "x-inout-client-ip": ip,
    "x-inout-client-ip-mac": createHmac("sha256", key).update(ip).digest("hex"),
  };
}

function apiHeaders(request?: Request): Record<string, string> {
  return {
    authorization: `Basic ${Buffer.from(`inout-web:${webSecret()}`).toString("base64")}`,
    "content-type": "application/json",
    accept: "application/json",
    ...clientIpHeaders(request),
  };
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function identityCommand(
  path: string,
  body: unknown,
  request?: Request,
) {
  const response = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    cache: "no-store",
    headers: apiHeaders(request),
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as IdentityPayload;
  return { status: response.status, payload };
}

async function grant(form: Record<string, string>) {
  const response = await fetch(`${apiBase()}/connect/token`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams(form),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!response.ok || !payload.access_token || !payload.refresh_token)
    return null;
  return payload;
}

export async function writeOpaqueSession(sessionId: string, csrf: string) {
  const jar = await cookies();
  jar.set(
    sessionCookie,
    sealSessionId(sessionId, sessionKey()),
    cookieOptions(),
  );
  jar.set(csrfCookie, csrf, cookieOptions());
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(sessionCookie, "", { ...cookieOptions(), maxAge: 0 });
  jar.set(csrfCookie, "", { ...cookieOptions(), maxAge: 0 });
}

export async function readSessionId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(sessionCookie)?.value;
  return raw ? openSessionId(raw, sessionKeys()) : null;
}

export async function readCsrf(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(csrfCookie)?.value ?? null;
}

async function apiSession(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    cache: "no-store",
    headers: apiHeaders(),
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as StoredSession & {
    code?: string;
  };
  if (!response.ok) return null;
  return payload;
}

export async function sessionFromTicket(
  ticket: string | undefined,
  user: IdentityPayload["user"],
) {
  if (!ticket || !user) return false;
  const tokens = await grant({
    grant_type: "identity_ticket",
    client_id: "inout-web",
    client_secret: webSecret(),
    ticket,
    scope: "openid email profile offline_access",
  });
  if (!tokens?.access_token || !tokens.refresh_token) return false;
  const stored = await apiSession("/api/v1/identity/sessions", {
    userId: user.id,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  });
  if (!stored?.sessionId || !stored.csrf) return false;
  await writeOpaqueSession(stored.sessionId, stored.csrf);
  return true;
}

export async function pendingSession(ticket: string, purpose: string) {
  const stored = await apiSession("/api/v1/identity/sessions/pending", {
    ticket,
    purpose,
  });
  if (!stored?.sessionId || !stored.csrf) return false;
  await writeOpaqueSession(stored.sessionId, stored.csrf);
  return true;
}

export async function resolveSession(): Promise<StoredSession | null> {
  const sessionId = await readSessionId();
  if (!sessionId) return null;
  const stored = await apiSession("/api/v1/identity/sessions/resolve", {
    sessionId,
  });
  if (!stored?.sessionId) {
    await clearSession();
    return null;
  }
  return { ...stored, csrf: (await readCsrf()) ?? stored.csrf };
}

export async function completeMfa(code: string) {
  const sessionId = await readSessionId();
  if (!sessionId) return null;
  const completed = await apiSession("/api/v1/identity/sessions/mfa", {
    sessionId,
    code,
  });
  if (!completed?.loginTicket || !completed.user) return null;
  if (!(await sessionFromTicket(completed.loginTicket, completed.user)))
    return null;
  return completed;
}

export async function rotateSession() {
  const sessionId = await readSessionId();
  if (!sessionId) return null;
  const rotated = await apiSession("/api/v1/identity/sessions/rotate", {
    sessionId,
  });
  if (!rotated?.sessionId || !rotated.csrf) return null;
  await writeOpaqueSession(rotated.sessionId, rotated.csrf);
  return rotated;
}

export async function revokeStoredSession() {
  const sessionId = await readSessionId();
  if (sessionId) {
    await apiSession("/api/v1/identity/sessions/revoke", { sessionId });
  }
  await clearSession();
}

export async function guardMutation(request: Request, requireCsrf = false) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ code: "csrf_rejected" }, { status: 403 });
  }
  if (requireCsrf) {
    const csrf = await readCsrf();
    if (!verifyCsrf(request, csrf)) {
      return NextResponse.json({ code: "csrf_rejected" }, { status: 403 });
    }
  } else if (await readSessionId()) {
    const csrf = await readCsrf();
    if (!verifyCsrf(request, csrf)) {
      return NextResponse.json({ code: "csrf_rejected" }, { status: 403 });
    }
  }
  return null;
}

export function commandResponse(
  status: number,
  payload: { code?: string; confirmationRequired?: boolean },
) {
  return NextResponse.json(
    {
      code: payload.code ?? "provider_error",
      confirmationRequired: payload.confirmationRequired ?? true,
    },
    { status: status === 200 ? 200 : status },
  );
}

export { verifySameOrigin, verifyCsrf } from "./session-cookie";

export async function proxyApi(request: Request, path: string[]) {
  if (
    path.some(
      (segment) =>
        segment === ".." ||
        segment === "." ||
        segment.includes("/") ||
        segment.includes("\\"),
    )
  ) {
    return NextResponse.json({ code: "invalid_path" }, { status: 400 });
  }
  const rejected = await guardMutation(
    request,
    request.method !== "GET" && request.method !== "HEAD",
  );
  if (rejected && request.method !== "GET" && request.method !== "HEAD") {
    return rejected;
  }
  const session = await resolveSession();
  const csrf = await readCsrf();
  const authorization = request.headers.get("authorization");
  if (
    !session ||
    session.purpose !== "authenticated" ||
    !session.accessToken ||
    !csrf ||
    authorization !== `Bearer ${csrf}`
  ) {
    return NextResponse.json({ code: "session_missing" }, { status: 401 });
  }
  const target = `${apiBase()}/api/v1/${path.map(encodeURIComponent).join("/")}${new URL(request.url).search}`;
  const headers = new Headers(request.headers);
  headers.set("authorization", `Bearer ${session.accessToken}`);
  headers.delete("cookie");
  headers.delete("host");
  const response = await fetch(target, {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.text(),
    cache: "no-store",
    redirect: "manual",
  });
  const body = await response.arrayBuffer();
  const forwarded = new NextResponse(body, { status: response.status });
  const type = response.headers.get("content-type");
  if (type) forwarded.headers.set("content-type", type);
  return forwarded;
}
