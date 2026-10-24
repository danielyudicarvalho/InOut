"use client";

import { type FormEvent } from "react";
import { useRecoveryRequest } from "../lib/auth/use-password-recovery";
import Image from "next/image";
import Link from "next/link";
import { Plant, EnvelopeSimple, ArrowLeft } from "@phosphor-icons/react";

export function ForgotPasswordScreen() {
  const { submitted, setSubmitted, busy, notice, request } =
    useRecoveryRequest();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void request(String(data.get("email")));
  }
  return (
    <main
      className={`signin recovery password-recovery ${submitted ? "recovery-sent" : ""}`}
    >
      <section
        className="signin-art"
        aria-label="Vamos encontrar o caminho de volta"
      >
        <Image
          src="/images/pipo-recovery-desktop.webp"
          alt="Pipo segurando uma chave dourada ao lado de um envelope em seu ninho"
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
            Vamos encontrar
            <br />o caminho de volta.
          </h1>
        </div>
      </section>
      <section className="signin-panel">
        <Link href="/" className="brand">
          <Plant size={30} weight="duotone" />
          ninho
        </Link>
        <div className="signin-form">
          <Image
            src={
              submitted
                ? "/images/pipo-recovery-sent.webp"
                : "/images/pipo-recovery-mobile.webp"
            }
            alt={
              submitted
                ? "Pipo abraçando um envelope"
                : "Pipo com uma chave e um envelope"
            }
            width={600}
            height={240}
            className="recovery-mobile-art"
            priority
          />
          <h1 className="confirmation-title">
            {submitted ? "Confira seu e-mail" : "Esqueceu sua senha?"}
          </h1>
          {submitted ? (
            <div role="status">
              <p className="recovery-copy">
                Se houver um cadastro com esse e-mail, você receberá um link
                para redefinir sua senha.
              </p>
              <p className="register-help">
                Confira também o spam ou lixo eletrônico.
              </p>
            </div>
          ) : (
            <>
              <p className="recovery-copy">
                Tudo bem. Vamos ajudar você
                <br />a voltar ao seu Ninho.
              </p>
              <form method="post" onSubmit={submit}>
                <label htmlFor="recovery-email">E-mail</label>
                <div className="signin-input">
                  <EnvelopeSimple size={21} aria-hidden="true" />
                  <input
                    id="recovery-email"
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    placeholder="voce@exemplo.com"
                    aria-describedby="recovery-help"
                  />
                </div>
                <p id="recovery-help" className="register-help">
                  Informe o e-mail usado no seu cadastro.
                </p>
                <button
                  className="primary signin-submit recovery-submit"
                  type="submit"
                  disabled={busy}
                  aria-busy={busy}
                >
                  {busy ? "Enviando…" : "Enviar link de recuperação"}
                </button>
              </form>
            </>
          )}
          <p role="status" className="signin-notice">
            {notice}
          </p>
          <Link
            href="/entrar"
            className={submitted ? "primary" : "signin-back recovery-back"}
          >
            {!submitted && <ArrowLeft size={18} aria-hidden="true" />}Voltar
            para entrar
          </Link>
          {submitted && (
            <button
              className="confirmation-resend"
              onClick={() => setSubmitted(false)}
            >
              Informar outro e-mail
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
