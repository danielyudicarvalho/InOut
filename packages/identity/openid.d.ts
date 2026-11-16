import type { AuthRepository } from "./index.js";

export function createOpenIdAuthRepository(options: {
  issuer: string;
  clientId: string;
  redirectUri: string;
  storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    deleteItem(key: string): Promise<void>;
  };
  openBrowser(url: string, redirectUri?: string): Promise<{ url?: string } | null>;
  fetch: typeof fetch;
  sha256(value: string): Promise<Uint8Array>;
  randomBytes(length: number): Promise<Uint8Array>;
  now?: () => number;
}): AuthRepository & { accessToken(): Promise<string | null> };

export function readCallbackParams(
  url: string | URL,
  expectedRedirectUri: string,
): { code: string; state: string; error: string };

export function completeAuthorizationCallback(input: {
  url: string;
  expectedRedirectUri: string;
  pending: {
    verifier: string;
    state: string;
    redirectUri: string;
    createdAt?: number;
  };
  now: () => number;
  markUsed: (state: string) => Promise<boolean>;
}): Promise<{ code: string; verifier: string; redirectUri: string }>;

export function createOpenIdSession(repository: {
  accessToken(): Promise<string | null>;
  currentUser(): Promise<{ id: string } | null>;
}): {
  auth: {
    getSession(): Promise<{
      data: { session: { access_token: string; user: { id: string } } | null };
      error: null;
    }>;
    getUser(): Promise<{ data: { user: { id: string } | null }; error: null }>;
    startAutoRefresh(): void;
    stopAutoRefresh(): void;
  };
};
