"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Plant,
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
  state = "pending",
}: {
  state?: ConfirmationState;
}) {
  const [notice, setNotice] = useState("");
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
            <Plant size={30} weight="duotone" />
            ninho
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
          <Plant size={30} weight="duotone" />
          ninho
        </Link>
        <div className="signin-form">
          <p className="confirmation-preview">
            Prévia de interface · sem validação de e-mail integrada
          </p>
          <h1 className="confirmation-title">{current.title}</h1>
          {state === "pending" && (
            <p className="confirmation-recipient">
              Enviamos um link de confirmação para
              <br />
              <strong>voce@exemplo.com</strong>
              <small>Endereço ilustrativo desta prévia.</small>
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
            <button
              className={
                state === "invalid"
                  ? "primary confirmation-resend"
                  : "confirmation-resend"
              }
              onClick={() =>
                setNotice(
                  "O reenvio estará disponível quando a autenticação for integrada. Nenhum e-mail foi enviado nesta prévia.",
                )
              }
            >
              {state === "invalid"
                ? "Solicitar novo e-mail"
                : "Reenviar e-mail"}
            </button>
          )}
          <p role="status" className="signin-notice">
            {notice}
          </p>
          <Link href="/entrar" className="signin-back">
            Voltar para entrar
          </Link>
          <nav
            aria-label="Estados de demonstração"
            className="confirmation-demo"
          >
            <span>Ver prévias:</span>
            <Link href="/confirmar-email">Pendente</Link>
            <Link href="/email-confirmado">Confirmado</Link>
            <Link href="/link-invalido">Link inválido</Link>
          </nav>
        </div>
      </section>
    </main>
  );
}
