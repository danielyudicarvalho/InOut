import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  csrfCookieName,
  openSessionId,
  sealSessionId,
  sessionCookieName,
  sessionKey,
  sessionKeys,
  verifyCsrf,
  verifySameOrigin,
} from "./session-cookie";
import { bffIpKey, clientIpFromRequest, signedClientIpHeaders } from "./bff-ip";

export { bffIpKey, clientIpFromRequest, signedClientIpHeaders } from "./bff-ip";

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

function clientIpHeaders(request: Request): Record<string, string> {
  return signedClientIpHeaders(clientIpFromRequest(request), bffIpKey());
}

function apiHeaders(request: Request): Record<string, string> {
  return {
    authorization: `Basic ${Buffer.from(`inout-web:${webSecret()}`).toString("base64")}`,
    "content-type": "application/json",
    accept: "application/json",
    ...clientIpHeaders(request),
  };
}

function cookieOptions() {
  const production = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: production,
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function identityCommand(
  path: string,
  body: unknown,
  request: Request,
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

async function grant(request: Request, form: Record<string, string>) {
  const response = await fetch(`${apiBase()}/connect/token`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      ...clientIpHeaders(request),
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
    sessionCookieName(),
    sealSessionId(sessionId, sessionKey()),
    cookieOptions(),
  );
  jar.set(csrfCookieName(), csrf, cookieOptions());
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(sessionCookieName(), "", { ...cookieOptions(), maxAge: 0 });
  jar.set(csrfCookieName(), "", { ...cookieOptions(), maxAge: 0 });
}

export async function readSessionId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(sessionCookieName())?.value;
  return raw ? openSessionId(raw, sessionKeys()) : null;
}

export async function readCsrf(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(csrfCookieName())?.value ?? null;
}

async function apiSession(
  request: Request,
  path: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    cache: "no-store",
    headers: apiHeaders(request),
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as StoredSession & {
    code?: string;
  };
  if (!response.ok) return null;
  return payload;
}

export async function sessionFromTicket(
  request: Request,
  ticket: string | undefined,
  user: IdentityPayload["user"] | null,
) {
  if (!ticket || !user) return false;
  const tokens = await grant(request, {
    grant_type: "identity_ticket",
    client_id: "inout-web",
    client_secret: webSecret(),
    ticket,
    scope: "openid email profile offline_access",
  });
  if (!tokens?.access_token || !tokens.refresh_token) return false;
  const stored = await apiSession(request, "/api/v1/identity/sessions", {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  });
  if (!stored?.sessionId || !stored.csrf) return false;
  await writeOpaqueSession(stored.sessionId, stored.csrf);
  return true;
}

export async function pendingSession(
  request: Request,
  ticket: string,
  purpose: string,
) {
  const stored = await apiSession(
    request,
    "/api/v1/identity/sessions/pending",
    {
      ticket,
      purpose,
    },
  );
  if (!stored?.sessionId || !stored.csrf) return false;
  await writeOpaqueSession(stored.sessionId, stored.csrf);
  return true;
}

export async function resolveSession(
  request: Request,
): Promise<StoredSession | null> {
  const sessionId = await readSessionId();
  if (!sessionId) return null;
  const stored = await apiSession(
    request,
    "/api/v1/identity/sessions/resolve",
    {
      sessionId,
    },
  );
  if (!stored?.sessionId) {
    await clearSession();
    return null;
  }
  return { ...stored, csrf: (await readCsrf()) ?? stored.csrf };
}

export async function completeMfa(
  request: Request,
  code: string,
  password = "",
) {
  const sessionId = await readSessionId();
  const csrf = await readCsrf();
  if (!sessionId || !csrf) return null;
  const completed = await apiSession(request, "/api/v1/identity/sessions/mfa", {
    sessionId,
    csrf,
    code,
    password,
  });
  if (!completed?.loginTicket || !completed.user) return null;
  if (
    !(await sessionFromTicket(request, completed.loginTicket, completed.user))
  )
    return null;
  return completed;
}

export async function rotateSession(request: Request) {
  const sessionId = await readSessionId();
  const csrf = await readCsrf();
  if (!sessionId || !csrf) return null;
  const rotated = await apiSession(
    request,
    "/api/v1/identity/sessions/rotate",
    {
      sessionId,
      csrf,
    },
  );
  if (!rotated?.sessionId || !rotated.csrf) return null;
  await writeOpaqueSession(rotated.sessionId, rotated.csrf);
  return rotated;
}

export async function revokeStoredSession(request: Request) {
  const sessionId = await readSessionId();
  const csrf = await readCsrf();
  if (sessionId) {
    await apiSession(request, "/api/v1/identity/sessions/revoke", {
      sessionId,
      csrf: csrf ?? "",
    });
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
  const session = await resolveSession(request);
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
