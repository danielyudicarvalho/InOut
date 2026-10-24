"use client";

import { useState, type FormEvent } from "react";
import { usePasswordReset } from "../lib/auth/use-password-recovery";
import Image from "next/image";
import Link from "next/link";
import {
  Plant,
  LockSimple,
  Eye,
  EyeSlash,
  ArrowLeft,
} from "@phosphor-icons/react";

export function ResetPasswordScreen() {
  const [visible, setVisible] = useState({
    password: false,
    confirmation: false,
  });
  const { status, complete, busy, notice, setNotice, reset, signOut } =
    usePasswordReset();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (
      await reset({
        password: String(data.get("password")),
        confirmation: String(data.get("confirmation")),
      })
    ) {
      form.reset();
      setVisible({ password: false, confirmation: false });
    }
  }
  return (
    <main
      className={`signin recovery password-reset ${complete ? "recovery-sent" : ""}`}
    >
      <section
        className="signin-art"
        aria-label="Um novo começo, com segurança"
      >
        <Image
          src="/images/pipo-reset-desktop.webp"
          alt="Pipo segurando uma chave dourada, com um caderno verde em seu ninho"
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
            Um novo começo,
            <br />
            com segurança.
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
              complete
                ? "/images/pipo-reset-success.webp"
                : "/images/pipo-reset-mobile.webp"
            }
            alt={
              complete
                ? "Pipo com uma chave ao lado de um cadeado confirmado"
                : "Pipo segurando uma chave dourada entre flores"
            }
            width={600}
            height={240}
            className="recovery-mobile-art"
            priority
          />
          <h1 className="confirmation-title">
            {complete ? "Senha alterada!" : "Definir nova senha"}
          </h1>
          {complete ? (
            <div role="status">
              <p className="recovery-copy">
                Sua nova senha foi salva. Entre no Ninho para continuar.
              </p>
            </div>
          ) : status !== "ready" ? (
            <div role="status">
              <p className="recovery-copy">
                {status === "checking"
                  ? "Validando o link de recuperação…"
                  : "Este link não está disponível ou expirou. Solicite outro e-mail de recuperação."}
              </p>
              <Link href="/esqueci-senha" className="primary">
                Solicitar novo link
              </Link>
            </div>
          ) : (
            <>
              <p className="recovery-copy">
                Escolha uma nova senha para
                <br />
                acessar seu Ninho.
              </p>
              <form
                method="post"
                onSubmit={submit}
                onChange={() => setNotice("")}
              >
                {(["password", "confirmation"] as const).map((field) => (
                  <div key={field}>
                    <label htmlFor={field}>
                      {field === "password"
                        ? "Nova senha"
                        : "Confirmar nova senha"}
                    </label>
                    <div className="signin-input">
                      <LockSimple size={21} aria-hidden="true" />
                      <input
                        id={field}
                        name={field}
                        type={visible[field] ? "text" : "password"}
                        placeholder={
                          field === "password"
                            ? "Digite sua nova senha"
                            : "Repita sua nova senha"
                        }
                        autoComplete="new-password"
                        readOnly={busy}
                        required
                        minLength={8}
                        aria-describedby="reset-help"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`${visible[field] ? "Ocultar" : "Mostrar"} ${field === "password" ? "nova senha" : "confirmação de senha"}`}
                        aria-pressed={visible[field]}
                        onClick={() =>
                          setVisible({ ...visible, [field]: !visible[field] })
                        }
                      >
                        {visible[field] ? (
                          <EyeSlash size={21} />
                        ) : (
                          <Eye size={21} />
                        )}
                      </button>
                    </div>
                    {field === "password" && (
                      <p id="reset-help" className="register-help">
                        Use uma senha forte e exclusiva, com pelo menos 8
                        caracteres.
                      </p>
                    )}
                  </div>
                ))}
                <p role="alert" className="signin-notice">
                  {notice}
                </p>
                <button
                  type="submit"
                  disabled={busy}
                  aria-busy={busy}
                  className="primary signin-submit recovery-submit"
                >
                  {busy ? "Salvando…" : "Salvar nova senha"}
                </button>
              </form>
            </>
          )}
          {status !== "ready" || complete ? (
            <p role="status" className="signin-notice">
              {notice}
            </p>
          ) : null}
          <Link
            href="/entrar"
            className={complete ? "primary" : "signin-back recovery-back"}
          >
            {!complete && <ArrowLeft size={18} aria-hidden="true" />}
            {complete ? "Ir para entrar" : "Voltar para entrar"}
          </Link>
          {complete && notice && (
            <button
              className="confirmation-resend"
              disabled={busy}
              onClick={() => void signOut()}
            >
              Encerrar sessão
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
