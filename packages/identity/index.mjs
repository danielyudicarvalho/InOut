/** Identity application boundary: no React, routing, storage or provider SDK. */
export class AuthFailure extends Error {
  constructor(code) {
    super(code);
    this.name = "AuthFailure";
    this.code = code;
  }
}
const messages = {
  configuration:
    "Autenticação não configurada. Confira a URL e a chave publicável do Supabase.",
  invalid_email: "Informe um e-mail válido.",
  invalid_name: "Informe seu nome (até 100 caracteres).",
  weak_password: "Use uma senha com pelo menos 8 caracteres.",
  password_mismatch: "As senhas precisam ser iguais.",
  invalid_credentials: "E-mail ou senha incorretos.",
  email_not_confirmed: "Confirme seu e-mail antes de entrar.",
  over_email_send_rate_limit:
    "Aguarde alguns minutos antes de solicitar outro e-mail.",
  over_request_rate_limit:
    "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  otp_expired: "O código ou link expirou. Solicite um novo e-mail.",
  invalid_token: "Informe o código recebido por e-mail.",
  recovery_required:
    "Abra um link de recuperação válido neste navegador ou aplicativo. Se necessário, solicite outro e-mail.",
  same_password: "Escolha uma senha diferente da anterior.",
  reauthentication_needed:
    "Solicite um novo link de recuperação para continuar.",
  flow_state_expired:
    "Este link expirou. Solicite outro e-mail de recuperação.",
  flow_state_not_found:
    "Este link não está disponível. Solicite outro e-mail de recuperação.",
  bad_code_verifier:
    "Abra o link no mesmo navegador ou aplicativo em que fez a solicitação.",
  session_missing: "Entre novamente para continuar.",
};
export function authMessage(error) {
  return error instanceof AuthFailure
    ? (messages[error.code] ??
        "Não foi possível concluir. Tente novamente em instantes.")
    : "Não foi possível conectar. Confira sua conexão e tente novamente.";
}
function email(value) {
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
    throw new AuthFailure("invalid_email");
  return normalized;
}
export function createAuthService(repository) {
  return {
    async signIn(input) {
      if (!input.password) throw new AuthFailure("invalid_credentials");
      await repository.signIn({ ...input, email: email(input.email) });
    },
    async signUp(input) {
      const name = input.name.trim();
      if (!name || name.length > 100) throw new AuthFailure("invalid_name");
      if (input.password.length < 8) throw new AuthFailure("weak_password");
      if (input.password !== input.confirmation)
        throw new AuthFailure("password_mismatch");
      return repository.signUp({
        name,
        email: email(input.email),
        password: input.password,
      });
    },
    currentUser: () => repository.currentUser(),
    resend: (value) => repository.resend(email(value)),
    async confirm(value, token) {
      if (!/^\d{6,10}$/.test(token.trim()))
        throw new AuthFailure("invalid_token");
      await repository.confirm(email(value), token.trim());
    },
    async exchangeCode(code) {
      if (!code || code.length > 4096) throw new AuthFailure("invalid_token");
      await repository.exchangeCode(code);
    },
    async requestPasswordReset(value) {
      await repository.requestPasswordReset(email(value));
    },
    async exchangeRecoveryCode(code) {
      if (!code || code.length > 4096)
        throw new AuthFailure("recovery_required");
      await repository.exchangeRecoveryCode(code);
    },
    canResetPassword: () => repository.canResetPassword(),
    async resetPassword({ password, confirmation }) {
      if (password.length < 8) throw new AuthFailure("weak_password");
      if (password !== confirmation) throw new AuthFailure("password_mismatch");
      return repository.resetPassword(password);
    },
    signOut: () => repository.signOut(),
    subscribe: (listener) => repository.subscribe(listener),
  };
}

/** Reject privileged keys before sending any authentication request. */
export function requirePublicConfig(url, key) {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" &&
      !(
        parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname)
      )
    )
      throw new Error();
    if (parsed.username || parsed.password || !key) throw new Error();
    if (!key.startsWith("sb_publishable_")) {
      const body = key.split(".")[1];
      if (
        !body ||
        JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/"))).role !==
          "anon"
      )
        throw new Error();
    }
    return { url, key };
  } catch {
    throw new AuthFailure("configuration");
  }
}
