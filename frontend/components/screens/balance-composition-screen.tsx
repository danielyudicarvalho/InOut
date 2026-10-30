"use client";
import { BrandLogo } from "../ui/brand-logo";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { House, Wallet, Eye, EyeSlash, ArrowLeft } from "@phosphor-icons/react";
import {
  accountKindLabel,
  balanceComposition,
  money,
  periodLabel,
} from "@inout/finance";
import { useFinancialHome } from "../../lib/finance/use-financial-home";
export function BalanceCompositionScreen() {
  const params = useSearchParams();
  const household = params.get("household") ?? "",
    period = params.get("period") ?? "",
    currency = params.get("currency") ?? "";
  return (
    <BalanceView
      key={`${household}:${period}:${currency}:${params.get("account") ?? ""}`}
      initialHouseholdId={household}
      initialPeriod={period}
      initialCurrency={currency}
      initialAccountId={params.get("account") ?? ""}
    />
  );
}
function BalanceView({
  initialCurrency,
  initialAccountId,
  ...options
}: {
  initialHouseholdId: string;
  initialPeriod: string;
  initialCurrency: string;
  initialAccountId: string;
}) {
  const state = useFinancialHome(options);
  const heading = useRef<HTMLHeadingElement>(null);
  const [chosen, setCurrency] = useState(initialCurrency),
    [hidden, setHidden] = useState(false),
    [accountId, setAccount] = useState<string | null>(initialAccountId || null);
  useEffect(() => {
    heading.current?.focus();
  }, [accountId, state.status]);
  if (state.status !== "ready" || !state.data || !state.data.currencies.length)
    return (
      <main className="financial-state">
        <h1>Composição do saldo</h1>
        <p role="status">
          {state.status === "loading"
            ? "Carregando suas contas…"
            : state.status === "error"
              ? state.notice
              : "Nenhuma conta financeira disponível nesta residência."}
        </p>
        {state.status !== "loading" ? (
          <button className="primary" onClick={state.retry}>
            Tentar novamente
          </button>
        ) : null}
        <Link href="/inicio">Voltar ao início</Link>
      </main>
    );
  const data = state.data,
    currency = data.currencies.includes(chosen) ? chosen : data.currencies[0];
  const composition = balanceComposition(data, currency),
    account = composition.accounts.find((a) => a.id === accountId);
  const household = state.households.find((h) => h.id === state.householdId)!;
  const amount = (cents: number, code = currency) =>
    hidden ? "••••" : money(cents, code);
  const homeHref = `/inicio?${new URLSearchParams({ household: household.id, period: state.period, currency })}`;
  const colors = ["#64826b", "#96975c", "#c6ac61", "#a7b891", "#8b9d82"];
  function select(code: string) {
    setCurrency(code);
    setAccount(null);
  }
  return (
    <main className="dashboard balance-page">
      <aside className="dashboard-sidebar">
        <Link className="dashboard-brand" href={homeHref}>
          <BrandLogo />
        </Link>
        <nav aria-label="Navegação principal">
          <Link href={homeHref}>
            <House size={20} />
            Início
          </Link>
          <Link
            href={`/composicao-saldo?${new URLSearchParams({ household: household.id, period: state.period, currency })}`}
            aria-current="page"
          >
            <Wallet size={20} />
            Contas
          </Link>
        </nav>
      </aside>
      <div className="dashboard-body">
        <header className="dashboard-topbar">
          <label>
            Residência
            <select
              aria-label="Residência atual"
              value={state.householdId}
              onChange={(e) => {
                setAccount(null);
                state.selectHousehold(e.target.value);
              }}
            >
              {state.households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
        </header>
        <section className="balance-heading">
          <div>
            <Link className="balance-back" href={homeHref}>
              <ArrowLeft size={18} />
              Início
            </Link>
            <h1 ref={heading} tabIndex={-1}>
              {account ? account.name : "Composição do saldo"}
            </h1>
            <p>
              {account
                ? "Detalhes da conta financeira."
                : "Veja quais contas formam seu saldo."}
            </p>
            <p className="dashboard-caption">{periodLabel(state.period)}</p>
          </div>
          <Image
            src="/images/pipo-balance-composition.webp"
            alt="Pipo conferindo um caderno ao lado de moedas"
            width={600}
            height={300}
            sizes="(max-width: 760px) 130px, 280px"
            preload
          />
        </section>
        <div className="dashboard-section-heading">
          <div
            className="dashboard-currencies"
            role="group"
            aria-label="Moeda da composição"
          >
            {data.currencies.map((code) => (
              <button
                key={code}
                aria-pressed={currency === code}
                onClick={() => select(code)}
              >
                {code}
              </button>
            ))}
          </div>
          <button
            className="balance-visibility"
            aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
            aria-pressed={hidden}
            onClick={() => setHidden(!hidden)}
          >
            {hidden ? <EyeSlash size={21} /> : <Eye size={21} />}
          </button>
        </div>
        {!composition.matched || !data.isReconciled ? (
          <p role="alert" className="dashboard-reconciliation">
            Há uma divergência nos registros ou na composição. Atualize os dados
            e confira os lançamentos.
          </p>
        ) : null}
        {accountId && !account && (
          <p role="status" className="dashboard-caption">
            A conta solicitada não está disponível nesta composição. Confira as
            contas abaixo ou selecione outro período.
          </p>
        )}
        {account ? (
          <section
            className="dashboard-panel balance-account-detail"
            aria-labelledby="account-detail-title"
          >
            <button className="balance-back" onClick={() => setAccount(null)}>
              <ArrowLeft size={18} />
              Voltar à composição
            </button>
            <h2 id="account-detail-title">{account.name}</h2>
            <p>
              {accountKindLabel(account.kind)} · {account.currency}
            </p>
            <dl>
              {[
                {
                  label: `Saldo em ${data.periodEnd.split("-").reverse().join("/")}`,
                  value: account.balance,
                },
                { label: "Créditos no período", value: account.inflow },
                { label: "Débitos no período", value: account.outflow },
                { label: "Variação no período", value: account.change },
              ].map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{amount(item.value)}</dd>
                </div>
              ))}
            </dl>
            <p className="dashboard-caption">
              Créditos e débitos da conta podem incluir transferências e
              ajustes; não equivalem às receitas e despesas da residência.
            </p>
          </section>
        ) : (
          <>
            <section className="dashboard-panel balance-overview">
              <p>Saldo em {currency}</p>
              <strong className="balance-total">
                {amount(composition.total)}
              </strong>
              <p className="dashboard-caption">
                {composition.accounts.length} contas · Saldo até{" "}
                {data.periodEnd.split("-").reverse().join("/")}
              </p>
              {!hidden ? (
                <>
                  <div className="balance-segments" aria-hidden="true">
                    {composition.accounts.map((a, index) => (
                      <span
                        key={a.id}
                        style={{
                          width: `${a.width}%`,
                          background:
                            a.balance < 0
                              ? "#d96746"
                              : colors[index % colors.length],
                        }}
                      />
                    ))}
                  </div>
                  <p className="dashboard-caption">
                    A barra representa valores absolutos; saldos negativos
                    aparecem em laranja. Percentuais abaixo usam o saldo
                    líquido.
                  </p>
                  <ul className="balance-legend">
                    {composition.accounts.map((a, index) => (
                      <li key={a.id}>
                        <i
                          style={{
                            background:
                              a.balance < 0
                                ? "#d96746"
                                : colors[index % colors.length],
                          }}
                        />
                        {a.name}: {amount(a.balance)} (
                        {a.percent === null
                          ? "sem percentual: saldo líquido zero"
                          : `${a.percent.toLocaleString("pt-BR")}%`}
                        )
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
            <section className="dashboard-panel balance-accounts">
              <h2>Contas que compõem o saldo</h2>
              <div className="balance-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Conta</th>
                      <th>Tipo</th>
                      <th>Saldo</th>
                      <th>
                        <span className="sr-only">Detalhes</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {composition.accounts.map((a) => (
                      <tr key={a.id}>
                        <th scope="row">
                          <Wallet size={20} aria-hidden="true" />
                          {a.name}
                        </th>
                        <td>{accountKindLabel(a.kind)}</td>
                        <td
                          className={a.balance < 0 ? "dashboard-negative" : ""}
                        >
                          {amount(a.balance)}
                        </td>
                        <td>
                          <button
                            onClick={() => setAccount(a.id)}
                            aria-label={`Ver detalhes de ${a.name}`}
                          >
                            Ver detalhes ›
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={2}>Total em {currency}</th>
                      <td colSpan={2}>{amount(composition.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </>
        )}
        <p className="dashboard-caption">
          Valores em moedas diferentes são exibidos separadamente.
        </p>
        <div className="balance-other-currencies">
          {data.currencies
            .filter((code) => code !== currency)
            .map((code) => (
              <button key={code} onClick={() => select(code)}>
                <span>
                  {code === "USD" ? "🇺🇸" : code === "BRL" ? "🇧🇷" : "💱"} Outra
                  moeda · {code}
                </span>
                <strong>
                  {amount(
                    data.summaries.find((s) => s.currency === code)!.balance,
                    code,
                  )}
                </strong>
                <span>Ver composição ›</span>
              </button>
            ))}
        </div>
        <button className="dashboard-text" onClick={state.retry}>
          Atualizar dados
        </button>
      </div>
    </main>
  );
}
