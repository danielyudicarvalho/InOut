export type AuthUser = { id: string; email: string; emailConfirmed: boolean };
export type Credentials = { email: string; password: string };
export type Registration = Credentials & { name: string; confirmation: string };
export type SignUpResult = "signedIn" | "confirmationRequired";
export interface AuthRepository {
  signIn(credentials: Credentials): Promise<void>;
  signUp(input: Credentials & { name: string }): Promise<SignUpResult>;
  currentUser(): Promise<AuthUser | null>;
  resend(email: string): Promise<void>;
  confirm(email: string, token: string): Promise<void>;
  exchangeCode(code: string): Promise<void>;
  signOut(): Promise<void>;
  subscribe(listener: () => void): () => void;
}
export class AuthFailure extends Error {
  readonly code: string;
  constructor(code: string);
}
export function authMessage(error: unknown): string;
export function createAuthService(repository: AuthRepository): {
  signIn(input: Credentials): Promise<void>;
  signUp(input: Registration): Promise<SignUpResult>;
  currentUser(): Promise<AuthUser | null>;
  resend(email: string): Promise<void>;
  confirm(email: string, token: string): Promise<void>;
  exchangeCode(code: string): Promise<void>;
  signOut(): Promise<void>;
  subscribe(listener: () => void): () => void;
};

export function requirePublicConfig(
  url: string | undefined,
  key: string | undefined,
): { url: string; key: string };
