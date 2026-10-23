"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plant,
  House,
  EnvelopeSimpleOpen,
  SignOut,
  X,
} from "@phosphor-icons/react";

const choices = [
  {
    id: "create",
    title: "Criar uma residência",
    description:
      "Organize suas finanças em um espaço seu. Você pode usar sozinho ou convidar outras pessoas depois.",
    action: "Criar residência",
    icon: House,
    detail:
      "Na próxima etapa você poderá informar o nome e as configurações iniciais da sua residência. Esse fluxo ainda não está disponível nesta prévia.",
  },
  {
    id: "invite",
    title: "Participar por convite",
    description:
      "Recebeu um convite? Entre na residência de quem vai compartilhar as finanças com você.",
    action: "Usar convite",
    icon: EnvelopeSimpleOpen,
    detail:
      "Na próxima etapa você poderá informar o código do convite, conferir a residência e confirmar sua participação. Esse fluxo ainda não está disponível nesta prévia.",
  },
] as const;
export function HouseholdChoiceScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<(typeof choices)[number] | null>(
    null,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
  }, [selected]);
  return (
    <main className="household-choice">
      <header className="household-header">
        <Link href="/" className="brand">
          <Plant size={34} weight="duotone" aria-hidden="true" />
          ninho
        </Link>
        <Link href="/entrar" className="household-exit">
          Sair
          <SignOut size={22} aria-hidden="true" />
        </Link>
      </header>
      <section aria-labelledby="household-title" className="household-content">
        <Image
          src="/images/pipo-home.webp"
          alt="Pipo em seu ninho ao lado de uma casinha entre plantas"
          width={520}
          height={220}
          priority
          className="household-hero"
        />
        <h1 id="household-title">Como você quer começar?</h1>
        <p className="household-subtitle">
          Crie seu espaço para cuidar das finanças ou entre em uma residência
          por convite.
        </p>
        <div className="household-options">
          {choices.map(({ icon: Icon, ...choice }) => (
            <article className="household-card" key={choice.id}>
              <div className="household-card-icon">
                <Icon size={82} weight="duotone" aria-hidden="true" />
              </div>
              <h2>{choice.title}</h2>
              <p>{choice.description}</p>
              <button
                className={
                  choice.id === "create" ? "primary" : "household-secondary"
                }
                onClick={() =>
                  choice.id === "create"
                    ? router.push("/criar-residencia")
                    : setSelected(
                        choices.find((item) => item.id === choice.id)!,
                      )
                }
              >
                {choice.action}
              </button>
            </article>
          ))}
        </div>
        <p className="household-footer">
          <Plant size={26} weight="duotone" aria-hidden="true" />
          Residência é o espaço das suas finanças no Ninho.
        </p>
        <p className="household-preview">
          Prévia de interface. Criar residência e usar convite ainda não estão
          integrados. Sair retorna à tela de entrada.
        </p>
      </section>
      <dialog
        ref={dialog}
        aria-labelledby="household-dialog-title"
        onClose={() => setSelected(null)}
      >
        <button
          className="close"
          aria-label="Fechar"
          onClick={() => dialog.current?.close()}
        >
          <X size={22} />
        </button>
        <h2 id="household-dialog-title">{selected?.title}</h2>
        <p>{selected?.detail}</p>
        <button className="primary" onClick={() => dialog.current?.close()}>
          Entendi
        </button>
      </dialog>
    </main>
  );
}
