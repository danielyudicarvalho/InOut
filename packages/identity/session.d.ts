import type { AuthUser, createAuthService } from "./index";
export type SessionSnapshot =
  | {
      status: "loading" | "expired" | "error" | "confirmationRequired";
      user: null;
      notice: string;
    }
  | { status: "authenticated"; user: AuthUser; notice: string };
export function createSessionRestorer(
  getAuth: () => Pick<
    ReturnType<typeof createAuthService>,
    "currentUser" | "subscribe"
  >,
  options?: { timeoutMs?: number },
): {
  getSnapshot(): SessionSnapshot;
  subscribe(listener: () => void): () => void;
  restore(): Promise<void>;
  start(): () => void;
};
