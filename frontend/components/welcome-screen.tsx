"use client";
import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowsLeftRight,
  UsersThree,
  Plant,
  CaretRight,
  X,
} from "@phosphor-icons/react";
const features = [
  {
    title: "Entradas",
    description: "O que você recebe",
    detail:
      "Acompanhe o dinheiro que chega à sua residência, como salários e outras receitas.",
    icon: Plant,
    tone: "green",
  },
  {
    title: "Saídas",
    description: "Para onde seu dinheiro vai",
    detail:
      "Organize as despesas do dia a dia por categoria e entenda seus gastos com tranquilidade.",
    icon: ArrowDown,
    tone: "peach",
  },
  {
    title: "Transferências",
    description: "Entre suas contas",
    detail:
      "Movimente dinheiro entre suas contas financeiras sem confundir transferências com receitas ou despesas.",
    icon: ArrowsLeftRight,
    tone: "yellow",
  },
  {
    title: "Juntos ou só você",
    description: "Compartilhe se quiser",
    detail:
      "Cuide da sua residência sozinho ou convide alguém para organizar as finanças com você.",
    icon: UsersThree,
    tone: "sage",
  },
];
export function WelcomeScreen() {
  const router = useRouter();
  const [content, setContent] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (content && !dialog.current?.open) dialog.current?.showModal();
  }, [content]);
  const next = (kind: "register" | "login") => {
    if (kind === "login") { router.push("/entrar"); return; }
    setContent({
      title:
        kind === "register"
          ? "Vamos preparar seu ninho?"
          : "Que bom ter você de volta!",
      description:
        kind === "register"
          ? "O próximo passo será criar seu usuário e depois criar uma residência ou participar por convite. Essa tela será construída na próxima etapa."
          : "A tela de entrar com e-mail e senha será construída na próxima etapa. Seu ninho está esperando por você.",
    });
  };
  return (
    <main className="welcome">
      <div className="artwork">
        <Image
          src="/images/pipo-home.webp"
          alt="Pipo, um passarinho amarelo de cachecol, em seu ninho ao lado de uma casinha entre plantas"
          fill
          priority
          sizes="(max-width: 760px) 100vw, 60vw"
        />
      </div>
      <header>
        <a href="/" className="brand" aria-label="Ninho, início">
          <Plant weight="duotone" size={35} aria-hidden="true" />
          ninho<span className="brand-caption">por InOut</span>
        </a>
        <button className="skip" onClick={() => next("login")}>
          Pular
        </button>
      </header>
      <section className="intro" aria-labelledby="welcome-title">
        <div className="eyebrow">UM NOVO COMEÇO PARA SUAS FINANÇAS</div>
        <h1 id="welcome-title">
          Seu dinheiro
          <br />
          encontra um lar.
        </h1>
        <p className="subtitle">
          Organize suas finanças com calma, do seu jeito.
        </p>
        <div className="features">
          {features.map(({ title, description, detail, icon: Icon, tone }) => (
            <button
              key={title}
              className="feature"
              onClick={() => setContent({ title, description: detail })}
            >
              <span className={"feature-icon " + tone}>
                <Icon size={29} weight="fill" aria-hidden="true" />
              </span>
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <CaretRight
                className="feature-chevron"
                size={17}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
        <div className="actions">
          <button className="primary" onClick={() => next("register")}>
            Vamos começar
            <CaretRight size={21} aria-hidden="true" />
          </button>
          <button className="login" onClick={() => next("login")}>
            Já tenho conta
          </button>
        </div>
        <p className="footnote">
          Um passo de cada vez. Um futuro mais tranquilo.
        </p>
      </section>
      <dialog
        ref={dialog}
        onClose={() => setContent(null)}
        aria-labelledby="dialog-title"
      >
        <button
          className="close"
          aria-label="Fechar"
          onClick={() => dialog.current?.close()}
        >
          <X size={22} />
        </button>
        <Plant size={36} weight="duotone" color="#587348" aria-hidden="true" />
        <h2 id="dialog-title">{content?.title}</h2>
        <p>{content?.description}</p>
        <button className="primary" onClick={() => dialog.current?.close()}>
          Entendi
        </button>
      </dialog>
    </main>
  );
}
