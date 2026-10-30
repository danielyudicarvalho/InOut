"use client";
import { BrandLogo } from "../ui/brand-logo";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, House, User } from "@phosphor-icons/react";

export function InvitationScreen() {
  const router = useRouter();
  const [step, setStep] = useState<"code" | "review">("code");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current === step) return;
    if (step === "review") heading.current?.focus();
    else input.current?.focus();
    previousStep.current = step;
  }, [step]);
  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const demoCode = code.trim().toUpperCase();
    if (!demoCode) {
      setNotice("Informe o código do convite.");
      input.current?.focus();
      return;
    }
    if (demoCode === "NINHO-EXPIRADO") {
      router.push("/convite-expirado");
      return;
    }
    if (demoCode === "NINHO-INVALIDO") {
      router.push("/convite-invalido");
      return;
    }
    if (demoCode === "NINHO-USADO") {
      router.push("/convite-utilizado");
      return;
    }
    if (demoCode !== "NINHO-7K2M") {
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
          <BrandLogo />
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
            preload
            sizes="(max-width: 760px) 1px, 50vw"
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
            sizes="(max-width: 760px) 100vw, 1px"
          />
        </div>
        <section
          className="create-household-panel"
          aria-labelledby="invitation-title"
        >
          <h1
            ref={heading}
            tabIndex={-1}
            className="invitation-title"
            id="invitation-title"
          >
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
                  ref={input}
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
                  aria-invalid={Boolean(notice)}
                  aria-describedby={
                    notice
                      ? "invitation-code-help invitation-notice"
                      : "invitation-code-help"
                  }
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
                onClick={() => router.push("/convite-aceito")}
              >
                Confirmar participação
              </button>
              <Link href="/comecar" className="signin-back">
                Agora não
              </Link>
            </>
          )}
          <p id="invitation-notice" role="status" className="signin-notice">
            {notice}
          </p>
          <details className="household-preview invitation-preview">
            <summary>Demonstração com dados fictícios</summary>
            <p>
              Use NINHO-7K2M para revisar o exemplo. Outros estados:
              NINHO-EXPIRADO, NINHO-INVALIDO e NINHO-USADO. A confirmação abre
              apenas uma prévia de resultado; nenhum convite é consultado ou
              aceito no servidor.
            </p>
          </details>
        </section>
      </div>
    </main>
  );
}
