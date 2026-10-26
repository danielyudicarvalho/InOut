"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  House,
  Receipt,
  Wallet,
  ChartPie,
  Target,
  Gear,
  ArrowUp,
  ArrowDown,
  ArrowsLeftRight,
  Plus,
  Plant,
} from "@phosphor-icons/react";
import {
  balances,
  currencies,
  history,
  money,
  months,
  navigation,
  summary,
  transactions,
  type Currency,
} from "../lib/dashboard/demo";
const icons = [House, Receipt, Wallet, ChartPie, Target, Gear];
export function DashboardScreen() {
  const [currency, setCurrency] = useState<Currency>("BRL");
  const [month, setMonth] = useState(5);
  const [notice, setNotice] = useState("");
  const current = summary(currency, month);
  const chart = history[currency].slice(0, month + 1);
  const maximum = Math.max(
    ...chart.flatMap((row) => [row.income, row.expense]),
  );
  function unavailable(label: string) {
    setNotice(
      `${label}: esta área ainda não está disponível nesta demonstração.`,
    );
  }
  return (
    <main className="dashboard">
      <aside className="dashboard-sidebar">
        <Link href="/inicio" className="dashboard-brand">
          <Plant size={32} weight="duotone" />
          Ninho
        </Link>
        <nav aria-label="Navegação principal">
          {navigation.map((label, index) => {
            const Icon = icons[index];
            return (
              <button
                key={label}
                type="button"
                aria-current={index === 0 ? "page" : undefined}
                onClick={() =>
                  index === 0 ? setNotice("") : unavailable(label)
                }
              >
                <Icon size={20} />
                {label}
              </button>
            );
          })}
        </nav>
        <p className="dashboard-motto">
          Mais vida boa
          <br />
          para o nosso amanhã. <span>♥</span>
        </p>
      </aside>
      <div className="dashboard-body">
        <header className="dashboard-topbar">
          <label>
            <House size={18} />
            <span className="sr-only">Residência atual</span>
            <select aria-label="Residência atual" defaultValue="demo">
              <option value="demo">Nosso Ninho · exemplo</option>
            </select>
          </label>
          <Link
            href="/comecar"
            className="dashboard-profile"
            aria-label="Escolher residência"
          >
            YN
          </Link>
        </header>
        <section className="dashboard-hero" aria-labelledby="dashboard-title">
          <div>
            <h1 id="dashboard-title">Seu ninho em equilíbrio</h1>
            <p>Organize hoje para um amanhã mais tranquilo.</p>
          </div>
          <Image
            src="/images/pipo-dashboard-hero.webp"
            width={600}
            height={300}
            alt="Pipo sorrindo entre folhas e flores"
            preload
            sizes="(max-width: 760px) 140px, 220px"
          />
          <label className="dashboard-period">
            <span className="sr-only">Período do resumo</span>
            <select
              aria-label="Período do resumo"
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            >
              {months.map((name, index) => (
                <option value={index} key={name}>
                  {name} de 2026
                </option>
              ))}
            </select>
          </label>
        </section>
        <p className="dashboard-preview">
          Demonstração com dados fictícios. Nenhuma informação financeira real é
          consultada.
        </p>
        <section aria-labelledby="balances-title">
          <h2 id="balances-title">Saldos por moeda</h2>
          <div className="dashboard-balances">
            {currencies.map((code) => (
              <article key={code} className="dashboard-balance">
                <span className="dashboard-flag" aria-hidden="true">
                  {code === "BRL" ? "🇧🇷" : "🇺🇸"}
                </span>
                <div>
                  <p>
                    {code === "BRL" ? "Real brasileiro" : "Dólar americano"} ·{" "}
                    {code}
                  </p>
                  <strong>{money(balances[code], code)}</strong>
                </div>
                <Wallet size={40} weight="duotone" aria-hidden="true" />
              </article>
            ))}
          </div>
          <p className="dashboard-caption">
            Saldos atuais de exemplo, sem conversão entre moedas.
          </p>
        </section>
        <section aria-labelledby="summary-title">
          <div className="dashboard-section-heading">
            <h2 id="summary-title">Resumo do período</h2>
            <div
              className="dashboard-currencies"
              role="group"
              aria-label="Moeda do resumo"
            >
              {currencies.map((code) => (
                <button
                  key={code}
                  aria-pressed={currency === code}
                  onClick={() => setCurrency(code)}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
          <div className="dashboard-summary">
            {[
              {
                label: "Receitas",
                value: current.income,
                icon: ArrowUp,
                kind: "income",
              },
              {
                label: "Despesas",
                value: current.expense,
                icon: ArrowDown,
                kind: "expense",
              },
              {
                label: "Resultado",
                value: current.result,
                icon: Plus,
                kind: "result",
              },
            ].map((item) => (
              <article
                key={item.label}
                className={`dashboard-stat ${item.kind}`}
              >
                <item.icon size={25} aria-hidden="true" />
                <div>
                  <p>{item.label}</p>
                  <strong>
                    {item.kind === "result" && item.value >= 0 ? "+ " : ""}
                    {money(item.value, currency)}
                  </strong>
                </div>
              </article>
            ))}
          </div>
          <p className="dashboard-caption">
            Receitas menos despesas no período. Transferências não entram no
            resultado.
          </p>
        </section>
        <div className="dashboard-detail-grid">
          <section className="dashboard-panel" aria-labelledby="chart-title">
            <div className="dashboard-section-heading">
              <h2 id="chart-title">Receitas x Despesas</h2>
              <span className="dashboard-legend">
                <i />
                Receitas <i />
                Despesas
              </span>
            </div>
            <div
              className="dashboard-chart"
              role="img"
              aria-label={`Receitas e despesas em ${currency}, de maio a ${months[month]} de 2026. Valores disponíveis na tabela abaixo.`}
            >
              {chart.map((row, index) => (
                <div key={index} className="dashboard-chart-column">
                  <div className="dashboard-bars">
                    <span
                      style={{ height: `${(row.income / maximum) * 100}%` }}
                    />
                    <span
                      style={{ height: `${(row.expense / maximum) * 100}%` }}
                    />
                  </div>
                  <span>{months[index].slice(0, 3)}</span>
                </div>
              ))}
            </div>
            <details className="dashboard-chart-data">
              <summary>Ver valores do gráfico</summary>
              <table>
                <caption>Valores em {currency} · 2026</caption>
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Receitas</th>
                    <th>Despesas</th>
                  </tr>
                </thead>
                <tbody>
                  {chart.map((row, index) => (
                    <tr key={index}>
                      <th>{months[index]}</th>
                      <td>{money(row.income, currency)}</td>
                      <td>{money(row.expense, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>
          <section
            className="dashboard-panel"
            aria-labelledby="transactions-title"
          >
            <div className="dashboard-section-heading">
              <h2 id="transactions-title">Últimos lançamentos</h2>
              <button
                className="dashboard-text"
                onClick={() => unavailable("Lançamentos")}
              >
                Ver todos
              </button>
            </div>
            <ul className="dashboard-transactions">
              {transactions(currency, month).map((row) => (
                <li key={row.name}>
                  <span
                    className={`dashboard-transaction-icon ${row.cents > 0 ? "income" : "expense"}`}
                  >
                    {row.icon === "transfer" ? (
                      <ArrowsLeftRight size={19} />
                    ) : row.cents > 0 ? (
                      <ArrowUp size={19} />
                    ) : (
                      <Receipt size={19} />
                    )}
                  </span>
                  <div>
                    <strong>{row.name}</strong>
                    <small>{row.category}</small>
                  </div>
                  <time
                    dateTime={`2026-${String(month + 5).padStart(2, "0")}-${String(row.day).padStart(2, "0")}`}
                  >
                    {row.day} de {months[month].slice(0, 3).toLowerCase()}.
                  </time>
                  <span
                    className={
                      row.cents > 0
                        ? "dashboard-positive"
                        : "dashboard-negative"
                    }
                  >
                    {row.cents > 0 ? "+ " : "− "}
                    {money(Math.abs(row.cents), currency)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="dashboard-caption">
              Amostra de lançamentos; a lista não representa o total do período.
            </p>
          </section>
        </div>
        <section aria-labelledby="actions-title">
          <h2 id="actions-title">Ações rápidas</h2>
          <div className="dashboard-actions">
            {["Registrar entrada", "Registrar saída", "Transferir"].map(
              (label, index) => (
                <button
                  key={label}
                  className={index === 1 ? "expense" : "income"}
                  onClick={() => unavailable(label)}
                >
                  {index === 2 ? (
                    <ArrowsLeftRight size={22} />
                  ) : (
                    <Plus size={22} />
                  )}
                  {label}
                </button>
              ),
            )}
          </div>
        </section>
        <p role="status" className="dashboard-notice">
          {notice}
        </p>
        <nav className="dashboard-bottom-nav" aria-label="Navegação mobile">
          {["Início", "Lançamentos", "Contas", "Mais"].map((label, index) => {
            const Icon = icons[index];
            return (
              <button
                key={label}
                aria-current={index === 0 ? "page" : undefined}
                onClick={() =>
                  index === 0 ? setNotice("") : unavailable(label)
                }
              >
                <Icon size={23} />
                {label}
              </button>
            );
          })}
        </nav>
      </div>
    </main>
  );
}
