import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  newCsrf,
  open,
  seal,
  sessionKey,
  type BffSession,
} from "./session-cookie";

const sessionCookie = "inout_session";
const csrfCookie = "inout_csrf";

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

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function identityCommand(path: string, body: unknown) {
  const response = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      authorization: `Basic ${Buffer.from(`inout-web:${webSecret()}`).toString("base64")}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    code?: string;
    ticket?: string;
    user?: { id: string; email: string; emailConfirmed: boolean };
  };
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

export async function writeSession(
  tokens: { access_token: string; refresh_token: string; expires_in?: number },
  user: BffSession["user"],
  recovery?: { ticket: string; expiresAt: number },
) {
  const current = await readSession();
  const session: BffSession = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + Number(tokens.expires_in ?? 600) * 1000,
    csrf: current?.csrf ?? newCsrf(),
    user,
    recoveryTicket: recovery?.ticket,
    recoveryExpiresAt: recovery?.expiresAt,
  };
  const jar = await cookies();
  jar.set(sessionCookie, seal(session, sessionKey()), cookieOptions());
  jar.set(csrfCookie, session.csrf, cookieOptions());
}

export async function readSession(): Promise<BffSession | null> {
  const jar = await cookies();
  const raw = jar.get(sessionCookie)?.value;
  return raw ? open(raw, sessionKey()) : null;
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(sessionCookie, "", { ...cookieOptions(), maxAge: 0 });
  jar.set(csrfCookie, "", { ...cookieOptions(), maxAge: 0 });
}

export async function sessionFromTicket(
  ticket: string | undefined,
  user: BffSession["user"],
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
  await writeSession(
    {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
    },
    user,
  );
  return true;
}

export async function refreshedSession(): Promise<BffSession | null> {
  const current = await readSession();
  if (!current) return null;
  if (
    current.accessToken === "recovery" ||
    current.expiresAt - 30_000 > Date.now()
  )
    return current;
  const tokens = await grant({
    grant_type: "refresh_token",
    client_id: "inout-web",
    client_secret: webSecret(),
    refresh_token: current.refreshToken,
  });
  if (!tokens?.access_token || !tokens.refresh_token) {
    await clearSession();
    return null;
  }
  await writeSession(
    {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
    },
    current.user,
    current.recoveryTicket
      ? {
          ticket: current.recoveryTicket,
          expiresAt: current.recoveryExpiresAt ?? 0,
        }
      : undefined,
  );
  return readSession();
}

export function commandResponse(status: number, payload: { code?: string }) {
  return NextResponse.json(
    { code: payload.code ?? "provider_error", confirmationRequired: true },
    { status: status === 200 ? 200 : status },
  );
}

export async function proxyApi(request: Request, path: string[]) {
  const session = await refreshedSession();
  const jar = await cookies();
  const csrf = jar.get(csrfCookie)?.value;
  const authorization = request.headers.get("authorization");
  if (
    !session ||
    !csrf ||
    csrf !== session.csrf ||
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
