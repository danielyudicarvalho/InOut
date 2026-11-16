import {
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export function sessionCookieName(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.NODE_ENV === "production"
    ? "__Host-inout_session"
    : "inout_session";
}

export function csrfCookieName(env: NodeJS.ProcessEnv = process.env): string {
  return env.NODE_ENV === "production" ? "__Host-inout_csrf" : "inout_csrf";
}

export function sessionKeys(env: NodeJS.ProcessEnv = process.env): Buffer[] {
  const keys: Buffer[] = [];
  if (env.BFF_SESSION_KEY) keys.push(decodeKey(env.BFF_SESSION_KEY));
  else if (env.NODE_ENV === "production") {
    throw new Error("BFF_SESSION_KEY is required in production.");
  } else {
    keys.push(createHash("sha256").update("dev-only-bff-session-key").digest());
  }
  if (env.BFF_SESSION_KEY_PREVIOUS) {
    keys.push(decodeKey(env.BFF_SESSION_KEY_PREVIOUS));
  }
  return keys;
}

export function sessionKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  return sessionKeys(env)[0];
}

function decodeKey(raw: string): Buffer {
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("BFF_SESSION_KEY must be 32 bytes encoded as base64.");
  }
  return key;
}

export function sealSessionId(sessionId: string, key: Buffer): string {
  const mac = createHmac("sha256", key).update(sessionId).digest("base64url");
  return `${sessionId}.${mac}`;
}

export function openSessionId(
  value: string,
  keys: Buffer[] = sessionKeys(),
): string | null {
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const sessionId = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  const actual = Buffer.from(mac);
  for (const key of keys) {
    const expected = Buffer.from(
      createHmac("sha256", key).update(sessionId).digest("base64url"),
    );
    if (
      actual.length === expected.length &&
      timingSafeEqual(actual, expected)
    ) {
      return sessionId;
    }
  }
  return null;
}

export function newCsrf(): string {
  return randomBytes(32).toString("base64url");
}

export function verifySameOrigin(request: Request): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (
    secFetchSite &&
    secFetchSite !== "same-origin" &&
    secFetchSite !== "none"
  ) {
    return false;
  }
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }
  if (!origin && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return false;
  }
  return true;
}

export function verifyCsrf(request: Request, expected: string | null): boolean {
  if (!expected) return false;
  const header =
    request.headers.get("x-csrf-token") ??
    request.headers.get("x-xsrf-token") ??
    "";
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const provided = header || bearer;
  if (!provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
