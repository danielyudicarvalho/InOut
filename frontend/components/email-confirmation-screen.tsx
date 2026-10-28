"use client";
import { BrandLogo } from "./brand-logo";

import { useConfirmation } from "../lib/auth/use-confirmation";
import Image from "next/image";
import Link from "next/link";
import {
  Clock,
  CheckCircle,
  Warning,
  EnvelopeSimple,
} from "@phosphor-icons/react";

type ConfirmationState = "pending" | "confirmed" | "invalid";
const content = {
  pending: {
    title: "Confirme seu e-mail",
    description: "Abra seu e-mail e toque no link para confirmar seu cadastro.",
    icon: Clock,
  },
  confirmed: {
    title: "E-mail confirmado!",
    description: "Seu acesso está pronto. Entre para continuar.",
    icon: CheckCircle,
  },
  invalid: {
    title: "Este link não é válido",
    description:
      "O link pode ter expirado ou já ter sido usado. Tente entrar ou solicite um novo e-mail.",
    icon: Warning,
  },
};

export function EmailConfirmationScreen({
  state: initialState = "pending",
}: {
  state?: ConfirmationState;
}) {
  const { state, email, setEmail, token, setToken, notice, busy, act } =
    useConfirmation(initialState);
  const current = content[state];
  const Icon = current.icon;
  return (
    <main className={`signin confirmation confirmation-${state}`}>
      <section
        className="signin-art"
        aria-label="Seu futuro financeiro começa aqui"
      >
        <Image
          src="/images/pipo-home.webp"
          alt="Pipo em seu ninho entre plantas"
          fill
          priority
          sizes="(max-width: 760px) 100vw, 55vw"
        />
        <div className="signin-art-copy">
          <Link href="/" className="brand">
            <BrandLogo />
          </Link>
          <h1>
            Falta só
            <br />
            um passinho.
          </h1>
          <p>
            Seu futuro financeiro
            <br />
            começa com um e-mail
            <br />
            confirmado.
          </p>
        </div>
      </section>
      <section className="signin-panel">
        <Link href="/" className="brand">
          <BrandLogo />
        </Link>
        <div className="signin-form">
          <h1 className="confirmation-title">{current.title}</h1>
          {state === "pending" && (
            <p className="confirmation-recipient">
              Confira o e-mail informado no cadastro
              <br />
              <strong>{email}</strong>
            </p>
          )}
          <div className="confirmation-badge">
            <Icon size={20} aria-hidden="true" />
            {state === "pending"
              ? "Confirmação pendente"
              : state === "confirmed"
                ? "Confirmação concluída"
                : "Link indisponível"}
          </div>
          <p className="confirmation-description">{current.description}</p>
          {state === "pending" && (
            <>
              <p className="confirmation-next">
                Depois, volte aqui e entre no Ninho.
              </p>
              <p className="confirmation-tip">
                <EnvelopeSimple size={18} aria-hidden="true" />
                Não encontrou? Confira o spam ou lixo eletrônico.
              </p>
            </>
          )}
          {state !== "invalid" && (
            <Link className="primary" href="/entrar">
              {state === "pending"
                ? "Já confirmei • Ir para entrar"
                : "Ir para entrar"}
            </Link>
          )}
          {state !== "confirmed" && (
            <form
              method="post"
              onSubmit={(event) => {
                event.preventDefault();
                void act("confirm");
              }}
            >
              <label htmlFor="confirmation-email">E-mail do cadastro</label>
              <div className="signin-input">
                <input
                  id="confirmation-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <label htmlFor="confirmation-code">
                Código recebido por e-mail
              </label>
              <div className="signin-input">
                <input
                  id="confirmation-code"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={10}
                  required
                />
              </div>
              <button
                className="primary signin-submit"
                type="submit"
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? "Aguarde…" : "Confirmar código"}
              </button>
              <button
                className="confirmation-resend"
                type="button"
                disabled={busy}
                onClick={() => void act("resend")}
              >
                Reenviar e-mail
              </button>
            </form>
          )}
          <p role="status" className="signin-notice">
            {notice}
          </p>
          <Link href="/entrar" className="signin-back">
            Voltar para entrar
          </Link>
        </div>
      </section>
    </main>
  );
}
