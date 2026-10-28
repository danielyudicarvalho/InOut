"use client";
import { BrandLogo } from "./brand-logo";

import { useState } from "react";
import { authMessage } from "@inout/identity";
import { getAuth } from "../lib/auth/composition";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plant, SignOut } from "@phosphor-icons/react";

const choices = [
  {
    id: "create",
    title: "Criar uma residência",
    description:
      "Organize suas finanças em um espaço seu. Você pode usar sozinho ou convidar outras pessoas depois.",
    action: "Criar residência",
    image: "/images/choice-create.webp",
    href: "/criar-residencia",
  },
  {
    id: "invite",
    title: "Participar por convite",
    description:
      "Recebeu um convite? Entre na residência de quem vai compartilhar as finanças com você.",
    action: "Usar convite",
    image: "/images/choice-invite.webp",
    href: "/entrar-convite",
  },
] as const;
export function HouseholdChoiceScreen() {
  const router = useRouter();
  const [exitBusy, setExitBusy] = useState(false);
  const [exitNotice, setExitNotice] = useState("");
  async function signOut() {
    if (exitBusy) return;
    setExitNotice("");
    setExitBusy(true);
    try {
      await getAuth().signOut();
      router.replace("/entrar");
    } catch (error) {
      setExitNotice(authMessage(error));
    } finally {
      setExitBusy(false);
    }
  }

  return (
    <main className="household-choice household-choice-start">
      <header className="household-header">
        <Link href="/" className="brand">
          <BrandLogo />
        </Link>
        <button
          type="button"
          className="household-exit auth-exit"
          disabled={exitBusy}
          onClick={() => void signOut()}
        >
          {exitBusy ? "Saindo…" : "Sair"}
          <SignOut size={22} aria-hidden="true" />
        </button>
      </header>
      {exitNotice ? (
        <p role="alert" className="signin-notice">
          {exitNotice}
        </p>
      ) : null}
      <section aria-labelledby="household-title" className="household-content">
        <Image
          src="/images/choice-hero.webp"
          alt="Pipo em seu ninho entre duas casinhas, flores e folhas"
          width={1200}
          height={480}
          sizes="(max-width: 760px) 100vw, 600px"
          preload
          className="household-hero"
        />
        <h1 id="household-title">Como você quer começar?</h1>
        <p className="household-subtitle">
          Crie seu espaço para cuidar das finanças ou entre em uma residência
          por convite.
        </p>
        <div className="household-options">
          {choices.map((choice) => (
            <article className="household-card" key={choice.id}>
              <Image
                src={choice.image}
                width={600}
                height={300}
                sizes="(max-width: 760px) 80vw, 280px"
                alt=""
                className="household-card-art"
              />
              <h2>{choice.title}</h2>
              <p>{choice.description}</p>
              <Link
                href={choice.href}
                className={
                  choice.id === "create" ? "primary" : "household-secondary"
                }
              >
                {choice.action}
              </Link>
            </article>
          ))}
        </div>
        <p className="household-footer">
          <Plant size={26} weight="duotone" aria-hidden="true" />
          Residência é o espaço das suas finanças no Ninho.
        </p>
      </section>
    </main>
  );
}
