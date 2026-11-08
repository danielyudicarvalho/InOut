import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export type BffSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  csrf: string;
  user: { id: string; email: string; emailConfirmed: boolean } | null;
  recoveryTicket?: string;
  recoveryExpiresAt?: number;
};

export function sessionKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env.BFF_SESSION_KEY;
  if (raw) {
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) {
      throw new Error("BFF_SESSION_KEY must be 32 bytes encoded as base64.");
    }
    return key;
  }
  if (env.NODE_ENV === "production") {
    throw new Error("BFF_SESSION_KEY is required in production.");
  }
  return createHash("sha256").update("dev-only-bff-session-key").digest();
}

export function seal(value: BffSession, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function open(value: string, key: Buffer): BffSession | null {
  const [iv, tag, ciphertext] = value.split(".");
  if (!iv || !tag || !ciphertext) return null;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const json = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const parsed = JSON.parse(json) as Partial<BffSession>;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.csrf)
      return null;
    return parsed as BffSession;
  } catch {
    return null;
  }
}

export function newCsrf(): string {
  return randomBytes(32).toString("base64url");
}
