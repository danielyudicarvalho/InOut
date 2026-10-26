"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Plant,
  Info,
  ArrowCircleDown,
  ArrowCircleUp,
} from "@phosphor-icons/react";

export function InitialAccountScreen({
  initialReady = false,
}: {
  initialReady?: boolean;
}) {
  const [ready, setReady] = useState(initialReady);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({
    name: "Minha conta principal",
    currency: "BRL",
    balance: "0,00",
    date: "",
  });
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const today = new Date();
      const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      setDraft((value) => ({ ...value, date: value.date || localDate }));
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (ready) heading.current?.focus();
  }, [ready]);
  function update(field: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setNotice("");
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (
      !String(data.get("name")).trim() ||
      String(data.get("name")).trim().length > 80
    ) {
      setNotice("Informe um nome de 1 a 80 caracteres.");
      return;
    }
    if (!/^-?\d{1,12}(,\d{1,2})?$/.test(String(data.get("balance")).trim())) {
      setNotice("Informe um saldo válido, como 1500,00 ou -100,50.");
      return;
    }
    setNotice("");
    setReady(true);
  }
  return (
    <main className="household-choice initial-account">
      <header className="household-header account-header">
        <Link href="/" className="brand">
          <Plant size={34} weight="duotone" aria-hidden="true" />
          ninho
        </Link>
        <span>Configuração inicial</span>
      </header>
      {ready ? (
        <section className="account-ready" aria-labelledby="ready-title">
          <Image
            src="/images/pipo-first-account-success.webp"
            alt="Pipo comemorando ao lado de uma carteira verde e um sinal de confirmação"
            width={600}
            height={240}
            preload
          />
          <div>
            <h1 id="ready-title" ref={heading} tabIndex={-1}>
              Conta pronta. Vamos ao primeiro lançamento?
            </h1>
            <p>
              Registre uma entrada ou saída para começar a acompanhar suas
              finanças.
            </p>
            <div className="account-next-actions">
              <button
                className="primary"
                onClick={() =>
                  setNotice(
                    "O formulário de entrada será implementado na próxima etapa.",
                  )
                }
              >
                <ArrowCircleDown size={28} aria-hidden="true" />
                Registrar entrada
              </button>
              <button
                className="account-expense"
                onClick={() =>
                  setNotice(
                    "O formulário de saída será implementado na próxima etapa.",
                  )
                }
              >
                <ArrowCircleUp size={28} aria-hidden="true" />
                Registrar saída
              </button>
            </div>
            <Link href="/inicio" className="signin-back">
              Ir para o início
            </Link>
            <button
              className="account-text-button"
              onClick={() => {
                setReady(false);
                setNotice("");
              }}
            >
              Revisar configuração
            </button>
          </div>
        </section>
      ) : (
        <div className="create-household-grid account-grid">
          <section className="account-story">
            <Image
              className="account-mobile-art"
              src="/images/pipo-first-account-mobile.webp"
              alt="Pipo ao lado de uma carteira verde e flores"
              width={640}
              height={256}
              preload
            />
            <h1>
              Vamos organizar
              <br />
              seu primeiro cantinho.
            </h1>
            <p>
              Adicione sua primeira conta financeira para começar a acompanhar
              seu dinheiro de forma simples e tranquila.
            </p>
            <Image
              className="account-desktop-art"
              src="/images/pipo-first-account-desktop.webp"
              alt="Pipo com uma carteira verde e um caderno no jardim de uma casinha"
              width={600}
              height={480}
              preload
            />
          </section>
          <section
            className="create-household-panel account-panel"
            aria-labelledby="account-title"
          >
            <h2 id="account-title">Sua primeira conta financeira</h2>
            <p>
              Adicione um lugar onde você guarda dinheiro, como banco ou
              carteira.
            </p>
            <aside className="account-info">
              <Info size={24} aria-hidden="true" />
              <span>
                Esta conta guarda seus registros financeiros.
                <br />
                Seu acesso ao Ninho já está criado.
              </span>
            </aside>
            <form onSubmit={submit} onChange={() => setNotice("")}>
              <label htmlFor="account-name">Nome da conta</label>
              <div className="signin-input">
                <input
                  id="account-name"
                  name="name"
                  value={draft.name}
                  onChange={(event) => update("name", event.target.value)}
                  maxLength={80}
                  required
                />
              </div>
              <label htmlFor="account-currency">Moeda</label>
              <div className="signin-input">
                <select
                  id="account-currency"
                  name="currency"
                  value={draft.currency}
                  onChange={(event) => update("currency", event.target.value)}
                >
                  <option value="BRL">Real brasileiro (BRL)</option>
                  <option value="USD">Dólar americano (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                </select>
              </div>
              <label htmlFor="account-balance">Saldo inicial</label>
              <div className="signin-input">
                <span className="account-currency-prefix" aria-hidden="true">
                  {draft.currency === "BRL"
                    ? "R$"
                    : draft.currency === "USD"
                      ? "US$"
                      : "€"}
                </span>
                <input
                  id="account-balance"
                  name="balance"
                  inputMode="decimal"
                  value={draft.balance}
                  onChange={(event) => update("balance", event.target.value)}
                  required
                  maxLength={16}
                  aria-describedby="balance-help"
                />
              </div>
              <label htmlFor="account-date">Data do saldo inicial</label>
              <div className="signin-input">
                <input
                  id="account-date"
                  name="date"
                  type="date"
                  required
                  value={draft.date}
                  onChange={(event) => update("date", event.target.value)}
                  min="1900-01-01"
                  max="9999-12-31"
                />
              </div>
              <aside
                className="account-info account-balance-help"
                id="balance-help"
              >
                <Info size={24} aria-hidden="true" />
                <span>
                  Quanto você tinha nessa conta na data escolhida? Esse é seu
                  ponto de partida, não uma nova entrada de dinheiro.
                  <br />
                  Se estiver começando sem saldo, mantenha 0,00.
                </span>
              </aside>
              <button type="submit" className="primary signin-submit">
                Criar conta financeira
              </button>
              <Link href="/inicio" className="signin-back">
                Configurar depois
              </Link>
            </form>
          </section>
        </div>
      )}
      <p role="status" className="signin-notice account-notice">
        {notice}
      </p>
      <p className="household-preview">
        Prévia de interface. Nenhuma conta ou lançamento é salvo; o saldo
        inicial não gera uma receita.
      </p>
    </main>
  );
}
