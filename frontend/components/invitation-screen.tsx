"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Plant,
  ArrowLeft,
  ShieldCheck,
  House,
  User,
} from "@phosphor-icons/react";

export function InvitationScreen() {
  const [step, setStep] = useState<"code" | "review">("code");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.trim().toUpperCase() !== "NINHO-7K2M") {
      setNotice(
        "Nesta prévia, use o código de demonstração NINHO-7K2M. Nenhum convite real foi consultado.",
      );
      return;
    }
    setNotice("");
    setStep("review");
  }
  function back() {
    setStep("code");
    setNotice("");
  }
  const art = step === "code" ? "invite-code" : "invite-review";
  return (
    <main className="household-choice invitation">
      <header className="household-header">
        <Link href="/" className="brand">
          <Plant size={34} weight="duotone" aria-hidden="true" />
          ninho
        </Link>
      </header>
      {step === "code" ? (
        <Link href="/comecar" className="create-household-back">
          <ArrowLeft size={20} aria-hidden="true" />
          Voltar
        </Link>
      ) : (
        <button
          className="invitation-back create-household-back"
          onClick={back}
        >
          <ArrowLeft size={20} aria-hidden="true" />
          Voltar
        </button>
      )}
      <div className="create-household-grid invitation-grid">
        <div className="invitation-art">
          <Image
            src={`/images/pipo-${art}-desktop.webp`}
            className="invitation-desktop-art"
            alt={
              step === "code"
                ? "Pipo segurando um envelope de convite com símbolo de uma casa"
                : "Pipo de asas abertas ao lado de uma casa de telhado verde"
            }
            width={600}
            height={480}
            priority
          />
          <Image
            src={`/images/pipo-${art}-mobile.webp`}
            className="invitation-mobile-art"
            alt={
              step === "code"
                ? "Pipo com o convite"
                : "Pipo dando boas-vindas junto à casa"
            }
            width={640}
            height={256}
          />
        </div>
        <section
          className="create-household-panel"
          aria-labelledby="invitation-title"
        >
          <h1 className="invitation-title" id="invitation-title">
            {step === "code" ? "Entrar por convite" : "Este é o seu convite"}
          </h1>
          <p className="household-subtitle">
            {step === "code"
              ? "Informe o código que você recebeu para encontrar sua residência."
              : "Revise as informações abaixo antes de confirmar sua participação."}
          </p>
          {step === "code" ? (
            <form onSubmit={verify}>
              <label htmlFor="invitation-code">Código do convite</label>
              <div className="signin-input">
                <input
                  id="invitation-code"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setNotice("");
                  }}
                  placeholder="NINHO-7K2M"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={64}
                  required
                  aria-describedby="invitation-code-help"
                />
              </div>
              <p className="register-help" id="invitation-code-help">
                Cole ou digite o código enviado por quem convidou você.
              </p>
              <button
                className="primary signin-submit recovery-submit"
                type="submit"
              >
                Verificar convite
              </button>
              <aside className="register-info">
                <ShieldCheck size={28} aria-hidden="true" />
                <span>Você poderá revisar o convite antes de participar.</span>
              </aside>
            </form>
          ) : (
            <>
              <dl className="invitation-details">
                <div>
                  <House size={30} aria-hidden="true" />
                  <div>
                    <dt>Residência</dt>
                    <dd>Ninho da Família</dd>
                  </div>
                </div>
                <div>
                  <User size={30} aria-hidden="true" />
                  <div>
                    <dt>Convite de</dt>
                    <dd>Ana</dd>
                  </div>
                </div>
              </dl>
              <p className="register-help">
                Ao aceitar, você passará a participar desta residência.
              </p>
              <aside className="register-info">
                <ShieldCheck size={28} aria-hidden="true" />
                <span>
                  Os dados financeiros só ficam disponíveis após a confirmação
                  da sua participação.
                </span>
              </aside>
              <button
                className="primary signin-submit"
                onClick={() =>
                  setNotice(
                    "Prévia concluída. Aceitar convites ainda não está integrado; você não foi adicionado a nenhuma residência.",
                  )
                }
              >
                Confirmar participação
              </button>
              <Link href="/comecar" className="signin-back">
                Agora não
              </Link>
            </>
          )}
          <p role="status" className="signin-notice">
            {notice}
          </p>
          <p className="household-preview">
            Prévia com dados fictícios. Use NINHO-7K2M para revisar o exemplo.
            Nenhum convite é verificado ou aceito no servidor.
          </p>
        </section>
      </div>
    </main>
  );
}
