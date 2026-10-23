"use client";
import { useState, type FormEvent } from "react";
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
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!String(data.get("name")).trim()) {
      setNotice("Informe o nome da conta.");
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
            priority
          />
          <div>
            <h1 id="ready-title" tabIndex={-1}>
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
            <Link href="/comecar" className="signin-back">
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
              priority
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
              priority
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
                  defaultValue="Minha conta principal"
                  maxLength={100}
                  required
                />
              </div>
              <label htmlFor="account-currency">Moeda</label>
              <div className="signin-input">
                <select
                  id="account-currency"
                  name="currency"
                  defaultValue="BRL"
                >
                  <option value="BRL">Real brasileiro (BRL)</option>
                  <option value="USD">Dólar americano (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                </select>
              </div>
              <label htmlFor="account-balance">Saldo inicial</label>
              <div className="signin-input">
                <input
                  id="account-balance"
                  name="balance"
                  inputMode="decimal"
                  defaultValue="0,00"
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
                  defaultValue={new Date().toISOString().slice(0, 10)}
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
              <Link href="/comecar" className="signin-back">
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
