"use client";
import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Plant,
  EnvelopeSimple,
  LockSimple,
  Eye,
  EyeSlash,
  CaretRight,
} from "@phosphor-icons/react";
export function LoginScreen() {
  const [visible, setVisible] = useState(false);
  const [notice, setNotice] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(
      "A integração com a autenticação será disponibilizada em uma próxima etapa.",
    );
  }
  return (
    <main className="signin">
      <section className="signin-art" aria-label="Seu ninho está esperando">
        <Image
          src="/images/pipo-home.webp"
          alt="Pipo em um ambiente acolhedor entre plantas"
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
            Bom ter
            <br />
            você de volta.
          </h1>
          <p>Seu ninho está te esperando.</p>
        </div>
      </section>
      <section className="signin-panel">
        <Link href="/" className="brand">
          <Plant size={30} weight="duotone" />
          ninho
        </Link>
        <div className="signin-form">
          <h2>
            <span className="signin-desktop-title">Entrar</span>
            <span className="signin-mobile-title">
              Bom ter
              <br />
              você de volta.
            </span>
          </h2>
          <p>Acesse seu cantinho financeiro.</p>
          <form onSubmit={submit}>
            <label htmlFor="email">E-mail</label>
            <div className="signin-input">
              <EnvelopeSimple size={21} aria-hidden="true" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                required
              />
            </div>
            <label htmlFor="password">Senha</label>
            <div className="signin-input">
              <LockSimple size={21} aria-hidden="true" />
              <input
                id="password"
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeSlash size={21} /> : <Eye size={21} />}
              </button>
            </div>
            <button
              className="signin-forgot"
              type="button"
              onClick={() =>
                setNotice(
                  "A recuperação de senha ainda não está disponível nesta prévia.",
                )
              }
            >
              Esqueci minha senha
            </button>
            <button className="primary signin-submit" type="submit">
              Entrar <CaretRight size={20} />
            </button>
            <p role="status" className="signin-notice">
              {notice}
            </p>
          </form>
          <div className="signin-divider">
            <span>Ainda não tem conta?</span>
          </div>
          <Link href="/criar-conta" className="signin-register">
            Criar conta
          </Link>
          <Link href="/" className="signin-back">
            Voltar ao início
          </Link>
        </div>
      </section>
    </main>
  );
}
