import { createHmac, randomBytes } from "node:crypto";

export function bffIpKey(env: NodeJS.ProcessEnv = process.env): string {
  if (env.BFF_IP_KEY) return env.BFF_IP_KEY;
  if (env.NODE_ENV === "production") {
    throw new Error("BFF_IP_KEY is required in production.");
  }
  return "";
}

export function clientIpFromRequest(request: Request): string {
  return request.headers.get("fly-client-ip")?.trim() ?? "";
}

export function signedClientIpHeaders(
  ip: string,
  key: string,
  now = Date.now(),
): Record<string, string> {
  if (!ip || !key) return {};
  const timestamp = Math.floor(now / 1000).toString();
  const nonce = randomBytes(16).toString("hex");
  const mac = createHmac("sha256", key)
    .update(`${ip}\n${timestamp}\n${nonce}`)
    .digest("hex");
  return {
    "x-inout-client-ip": ip,
    "x-inout-client-ip-ts": timestamp,
    "x-inout-client-ip-nonce": nonce,
    "x-inout-client-ip-mac": mac,
  };
}
