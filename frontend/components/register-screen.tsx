"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Plant,
  User,
  EnvelopeSimple,
  LockSimple,
  Eye,
  EyeSlash,
  Wallet,
} from "@phosphor-icons/react";

export function RegisterScreen() {
  const [visible, setVisible] = useState({
    password: false,
    confirmation: false,
  });
  const [notice, setNotice] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!String(data.get("name")).trim()) {
      setNotice("Informe seu nome.");
      return;
    }
    if (data.get("password") !== data.get("confirmation")) {
      setNotice("As senhas precisam ser iguais.");
      return;
    }
    setNotice(
      "Seu formulário está pronto. A criação de usuário será disponibilizada quando a autenticação estiver integrada.",
    );
  }
  return (
    <main className="signin register">
      <section
        className="signin-art"
        aria-label="Um novo começo para suas finanças"
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
            Um novo
            <br />
            começo para
            <br />
            suas finanças.
          </h1>
        </div>
      </section>
      <section className="signin-panel">
        <Link href="/" className="brand">
          <Plant size={30} weight="duotone" />
          ninho
        </Link>
        <div className="signin-form">
          <h2>
            Crie seu acesso
            <br />
            ao Ninho.
          </h2>
          <p>Seu cantinho financeiro começa aqui.</p>
          <form onSubmit={submit} onChange={() => setNotice("")}>
            <label htmlFor="name">Nome</label>
            <div className="signin-input">
              <User size={21} aria-hidden="true" />
              <input
                id="name"
                name="name"
                autoComplete="name"
                placeholder="Como podemos chamar você?"
                maxLength={100}
                required
              />
            </div>
            <label htmlFor="email">E-mail</label>
            <div className="signin-input">
              <EnvelopeSimple size={21} aria-hidden="true" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                required
              />
            </div>
            {(["password", "confirmation"] as const).map((field) => (
              <div key={field}>
                <label htmlFor={field}>
                  {field === "password" ? "Senha" : "Confirmar senha"}
                </label>
                <div className="signin-input">
                  <LockSimple size={21} aria-hidden="true" />
                  <input
                    id={field}
                    name={field}
                    type={visible[field] ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={
                      field === "password"
                        ? "Crie uma senha"
                        : "Repita sua senha"
                    }
                    minLength={8}
                    required
                    aria-describedby="password-help"
                  />
                  <button
                    type="button"
                    aria-label={`${visible[field] ? "Ocultar" : "Mostrar"} ${field === "password" ? "senha" : "confirmação de senha"}`}
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
              </div>
            ))}
            <p id="password-help" className="register-help">
              Use uma senha forte e exclusiva, com pelo menos 8 caracteres.
            </p>
            <aside className="register-info">
              <Wallet size={30} aria-hidden="true" />
              <div>
                <strong>Este é seu cadastro de usuário.</strong>
                <span>Suas contas financeiras serão adicionadas depois.</span>
              </div>
            </aside>
            <button className="primary signin-submit" type="submit">
              Criar meu acesso
            </button>
            <p role="status" className="signin-notice">
              {notice}
            </p>
          </form>
          <div className="signin-divider">
            <span>
              Já tem cadastro?{" "}
              <Link href="/entrar" className="register-login">
                Entrar
              </Link>
            </span>
          </div>
          <p className="register-terms">
            Ao continuar, você concorda com os{" "}
            <button
              onClick={() =>
                setNotice(
                  "Os Termos de Uso ainda não estão disponíveis nesta prévia.",
                )
              }
            >
              Termos de Uso
            </button>{" "}
            e a{" "}
            <button
              onClick={() =>
                setNotice(
                  "A Política de Privacidade ainda não está disponível nesta prévia.",
                )
              }
            >
              Política de Privacidade
            </button>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
