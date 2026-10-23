"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plant } from "@phosphor-icons/react";

type InvitationResult = "accepted" | "expired" | "invalid" | "used";
const results = {
  accepted: {
    title: "Convite aceito!",
    description: "Você agora faz parte da residência Ninho da Família.",
    primary: "Acessar residência",
    secondary: null,
  },
  expired: {
    title: "Este convite expirou",
    description: "Peça um novo convite a quem convidou você.",
    primary: "Informar outro código",
    secondary: "Voltar ao início",
  },
  invalid: {
    title: "Não encontramos este convite",
    description: "Confira o código informado ou peça um novo convite.",
    primary: "Revisar código",
    secondary: "Voltar ao início",
  },
  used: {
    title: "Este convite já foi utilizado",
    description:
      "Se você já participa da residência, acesse-a. Caso contrário, peça um novo convite.",
    primary: "Ver minhas residências",
    secondary: "Informar outro código",
  },
};
export function InvitationResultScreen({
  result,
}: {
  result: InvitationResult;
}) {
  const [notice, setNotice] = useState("");
  const current = results[result];
  return (
    <main className="invitation-result">
      <header className="invitation-result-header">
        <Link className="brand" href="/">
          <Plant size={32} weight="duotone" aria-hidden="true" />
          ninho
        </Link>
      </header>
      <section
        className="invitation-result-content"
        aria-labelledby="invitation-result-title"
      >
        <Image
          src={`/images/pipo-invite-${result}.webp`}
          alt={
            result === "accepted"
              ? "Pipo feliz ao lado de uma casa e um sinal de confirmação"
              : result === "expired"
                ? "Pipo com um envelope e um relógio"
                : result === "invalid"
                  ? "Pipo com um envelope e um ponto de interrogação"
                  : "Pipo ao lado de um envelope aberto e um símbolo de informação"
          }
          width={700}
          height={280}
          className="invitation-result-art"
          priority
        />
        <h1 id="invitation-result-title">{current.title}</h1>
        <p className="invitation-result-description">{current.description}</p>
        {result === "expired" || result === "invalid" ? (
          <Link
            href="/entrar-convite"
            className="primary invitation-result-action"
          >
            {current.primary}
          </Link>
        ) : (
          <button
            className="primary invitation-result-action"
            onClick={() =>
              setNotice(
                "O acesso às residências estará disponível em uma próxima etapa. Esta prévia não altera sua participação.",
              )
            }
          >
            {current.primary}
          </button>
        )}
        {current.secondary && (
          <Link
            className="invitation-result-secondary"
            href={result === "used" ? "/entrar-convite" : "/comecar"}
          >
            {current.secondary}
          </Link>
        )}
        <p role="status" className="signin-notice">
          {notice}
        </p>
        <p className="household-preview">
          Prévia de interface com dados fictícios. Nenhum convite foi consultado
          ou aceito; nenhuma participação foi alterada.
        </p>
        <nav
          className="confirmation-demo"
          aria-label="Resultados de demonstração"
        >
          <Link href="/convite-aceito">Aceito</Link>
          <Link href="/convite-expirado">Expirado</Link>
          <Link href="/convite-invalido">Inválido</Link>
          <Link href="/convite-utilizado">Já utilizado</Link>
        </nav>
      </section>
    </main>
  );
}
