"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { money, periodLabel, type FinancialAnalysis } from "@inout/finance";
import { useFinancialHome } from "../lib/finance/use-financial-home";
import { useAnalysis } from "../lib/finance/use-analysis";
import { PeriodPicker } from "./financial/selectors/period-picker";
import "./analysis.css";
export type AnalysisView =
  "hub" | "overview" | "compare" | "accounts" | "evolution" | "review";
const titles = {
  hub: "Análises",
  overview: "Visão geral do período",
  compare: "Comparar períodos",
  accounts: "Movimentação por conta",
  evolution: "Evolução financeira",
  review: "Revisão mensal",
};
const cards = [
  [
    "visao-geral",
    "Visão geral do período",
    "Receitas, despesas e resultado em um só lugar.",
    "01",
  ],
  [
    "comparar",
    "Comparar períodos",
    "Entenda o que mudou em relação ao período anterior.",
    "02",
  ],
  [
    "/resumo-categorias",
    "Despesas por categoria",
    "Veja a participação de cada categoria e subcategoria.",
    "03",
  ],
  [
    "/fontes-renda",
    "Receitas por fonte",
    "Conheça a distribuição das entradas da sua casa.",
    "04",
  ],
  [
    "contas",
    "Movimentação por conta",
    "Acompanhe entradas, saídas e transferências.",
    "05",
  ],
  [
    "evolucao",
    "Evolução financeira",
    "Observe receitas, despesas e resultado ao longo do tempo.",
    "06",
  ],
  [
    "revisao-mensal",
    "Revisão mensal",
    "Confira as mudanças relevantes e seus registros.",
    "07",
  ],
];
export function AnalysisScreen({ view = "hub" }: { view?: AnalysisView }) {
  const p = useSearchParams();
  return (
    <AnalysisContent
      key={`${p.get("household")}:${p.get("period")}:${p.get("currency")}`}
      view={view}
      household={p.get("household") ?? ""}
      period={p.get("period") ?? ""}
      initialCurrency={p.get("currency") ?? ""}
    />
  );
}
function AnalysisContent({
  view,
  household,
  period,
  initialCurrency,
}: {
  view: AnalysisView;
  household: string;
  period: string;
  initialCurrency: string;
}) {
  const home = useFinancialHome({
    initialHouseholdId: household,
    initialPeriod: period,
  });
  const [chosen, setCurrency] = useState(initialCurrency);
  const [picker, setPicker] = useState(false);
  const currency = home.data?.currencies.includes(chosen)
    ? chosen
    : (home.data?.currencies[0] ?? "");
  const report = useAnalysis(
    home.status === "ready" ? home.householdId : "",
    home.period,
    currency,
  );
  const query = new URLSearchParams({
    household: home.householdId,
    period: home.period,
    currency,
  }).toString();
  const href = (path: string) => `${path}?${query}`;
  const data = report.data;
  return (
    <main className="analysis-shell">
      <aside className="analysis-sidebar">
        <Link className="analysis-brand" href={href("/inicio")}>
          ✿ Ninho
        </Link>
        <nav aria-label="Navegação principal">
          <Link href={href("/inicio")}>Início</Link>
          <Link aria-current="page" href={href("/analises")}>
            Análises
          </Link>
          <Link href={href("/lancamentos")}>Lançamentos</Link>
          <Link href={href("/contas")}>Contas</Link>
        </nav>
        <p>Um olhar tranquilo para as finanças da sua casa.</p>
      </aside>
      <div className="analysis-body">
        <header className="analysis-top">
          <Link href={href(view === "hub" ? "/inicio" : "/analises")}>
            ← {view === "hub" ? "Início" : "Todas as análises"}
          </Link>
          <span>Ninho · Finanças da casa</span>
        </header>
        <section className="analysis-hero">
          <div>
            <p className="analysis-eyebrow">CUIDAR, ENTENDER, PLANEJAR</p>
            <h1>{titles[view]}</h1>
            <p>
              {view === "review"
                ? "Reserve um momento para entender o mês e conferir o que mudou."
                : "Pequenas descobertas para cuidar melhor do que é de vocês."}
            </p>
          </div>
          <Image
            src={
              view === "compare" || view === "evolution"
                ? "/images/pipo-analysis-growth.webp"
                : "/images/pipo-analysis.webp"
            }
            width={320}
            height={180}
            alt={
              view === "compare" || view === "evolution"
                ? "Pipo observa dois canteiros em diferentes estágios de crescimento"
                : "Pipo revisa o livro financeiro da casa com uma lupa e pequenos brotos"
            }
            priority
          />
        </section>
        <div className="analysis-filters">
          <label>
            Residência
            <select
              value={home.householdId}
              onChange={(e) => home.selectHousehold(e.target.value)}
            >
              {home.households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => setPicker(true)}>
            {home.period ? periodLabel(home.period) : "Selecionar período"} ▾
          </button>
          <label>
            Moeda
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {home.data?.currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              home.retry();
              report.retry();
            }}
          >
            Atualizar
          </button>
        </div>
        {picker && (
          <PeriodPicker
            value={home.period}
            onClose={() => setPicker(false)}
            onApply={(value) => {
              setPicker(false);
              home.selectPeriod(value);
            }}
          />
        )}
        {home.status === "error" ? (
          <p role="alert">{home.notice}</p>
        ) : home.status === "empty" ||
          (home.status === "ready" && !currency) ? (
          <section className="analysis-panel">
            <h2>Seu primeiro olhar começa aqui</h2>
            <p>Cadastre uma conta para acompanhar suas finanças.</p>
            <Link href={href("/contas")}>Gerenciar contas →</Link>
          </section>
        ) : report.notice ? (
          <p role="alert">
            {report.notice}{" "}
            <button onClick={report.retry}>Tentar novamente</button>
          </p>
        ) : !data ? (
          <p role="status">Preparando suas análises…</p>
        ) : (
          <>
            {!data.isReconciled && (
              <p role="alert" className="analysis-warning">
                Há divergência na conciliação dos registros. Confira os
                lançamentos antes de tirar conclusões.
              </p>
            )}
            {(view === "hub" || view === "overview" || view === "review") && (
              <section
                className="analysis-stats"
                aria-label="Resumo do período"
              >
                {[
                  ["Receitas", data.current.incomeCents, "/receitas"],
                  ["Despesas", data.current.expenseCents, "/despesas"],
                  ["Resultado", data.current.resultCents, "/resultado"],
                ].map(([label, value, path]) => (
                  <Link
                    className="analysis-stat"
                    key={label}
                    href={href(String(path))}
                  >
                    <span>{label}</span>
                    <strong>{money(Number(value), currency)}</strong>
                    <small>Conferir lançamentos →</small>
                  </Link>
                ))}
              </section>
            )}
            {view === "hub" && (
              <section className="analysis-grid" aria-label="Explorar análises">
                {cards.map(([path, title, description, number]) => (
                  <Link
                    className="analysis-card"
                    key={path}
                    href={href(
                      path.startsWith("/") ? path : `/analises/${path}`,
                    )}
                  >
                    <span>{number}</span>
                    <h2>{title}</h2>
                    <p>{description}</p>
                    <b aria-hidden="true">↗</b>
                  </Link>
                ))}
              </section>
            )}
            {view === "overview" && (
              <section className="analysis-panel">
                <h2>O retrato deste período</h2>
                <p>
                  Resultado é a diferença entre receitas e despesas.
                  Transferências entre contas não alteram o resultado.
                </p>
                <p>
                  {data.current.resultCents >= 0
                    ? "As receitas cobriram as despesas neste período."
                    : "As despesas superaram as receitas neste período."}
                </p>
                <Link href={href("/lancamentos")}>
                  Conferir todos os lançamentos →
                </Link>
                <nav className="analysis-inline">
                  <Link href={href("/resumo-categorias")}>Categorias</Link>
                  <Link href={href("/fontes-renda")}>Fontes de renda</Link>
                  <Link href={href("/analises/comparar")}>
                    Comparar períodos
                  </Link>
                </nav>
              </section>
            )}
            {(view === "compare" || view === "review") && (
              <Comparison data={data} />
            )}
            {view === "accounts" && (
              <section className="analysis-panel">
                <h2>O caminho do dinheiro</h2>
                <p>
                  Créditos e débitos incluem transferências, estornos e
                  eventuais saldos iniciais. As transferências aparecem
                  separadas e não são receitas ou despesas.
                </p>
                {data.accounts.length === 0 && (
                  <p>Nenhuma conta nesta moeda.</p>
                )}
                <div className="analysis-account-grid">
                  {data.accounts.map((a) => (
                    <article className="analysis-account" key={a.id}>
                      <h3>{a.name}</h3>
                      <dl>
                        {[
                          ["Receitas líquidas", a.incomeCents],
                          ["Despesas líquidas", a.expenseCents],
                          ["Transferências recebidas", a.transferInCents],
                          ["Transferências enviadas", a.transferOutCents],
                          ["Créditos totais", a.inflowCents],
                          ["Débitos totais", a.outflowCents],
                          ["Variação da conta", a.changeCents],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{money(Number(value), currency)}</dd>
                          </div>
                        ))}
                      </dl>
                      <Link
                        href={`${href("/lancamentos")}&accountId=${encodeURIComponent(a.id)}`}
                      >
                        Conferir movimentações →
                      </Link>
                    </article>
                  ))}
                </div>
              </section>
            )}
            {view === "evolution" && <Evolution data={data} />}
            {view === "review" && (
              <section className="analysis-panel">
                <h2>Mudanças que merecem um olhar</h2>
                <p>
                  Comparação com o período anterior. Valores por categoria são
                  diretos; subcategorias aparecem separadamente. Os fatos abaixo
                  não atribuem causas às mudanças.
                </p>
                {data.changes
                  .filter(
                    (c) =>
                      (c.kind === "category" || c.kind === "source") &&
                      c.deltaCents !== 0,
                  )
                  .sort(
                    (a, b) => Math.abs(b.deltaCents) - Math.abs(a.deltaCents),
                  )
                  .slice(0, 10)
                  .map((c) => (
                    <Link
                      className="analysis-change"
                      key={`${c.kind}:${c.id}`}
                      href={`${href(c.id ? "/lancamentos" : "/fontes-renda")}${c.id ? `&${c.kind === "category" ? "categoryId" : "incomeSourceId"}=${encodeURIComponent(c.id)}` : ""}`}
                    >
                      <span>
                        <small>
                          {c.kind === "category"
                            ? "Categoria de despesa"
                            : "Fonte de renda"}
                        </small>
                        <b>{c.name}</b>
                      </span>
                      <span>
                        {money(c.previousCents, currency)} →{" "}
                        {money(c.currentCents, currency)}
                        <small>
                          Diferença: {money(c.deltaCents, currency)} ·{" "}
                          {percentage(c.percentageChange)}
                        </small>
                      </span>
                    </Link>
                  ))}
                {!data.changes.some(
                  (c) =>
                    (c.kind === "category" || c.kind === "source") &&
                    c.deltaCents !== 0,
                ) && (
                  <p>Não há mudanças por categoria ou fonte neste período.</p>
                )}
                <Link href={href("/lancamentos")}>
                  Conferir todos os registros →
                </Link>
              </section>
            )}
            <p className="analysis-footnote">
              Valores líquidos de estornos · Contas arquivadas preservadas no
              histórico · Moedas analisadas separadamente
            </p>
          </>
        )}
      </div>
    </main>
  );
}
function percentage(value: number | null) {
  return value === null
    ? "sem base percentual"
    : `${value > 0 ? "+" : ""}${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}
function dateLabel(value: string) {
  return value.split("-").reverse().join("/");
}
function Comparison({ data }: { data: FinancialAnalysis }) {
  return (
    <section className="analysis-panel">
      <h2>O que mudou?</h2>
      <p>
        Atual: {dateLabel(data.from)} a {dateLabel(data.to)} · Anterior:{" "}
        {dateLabel(data.previousFrom)} a {dateLabel(data.previousTo)}
      </p>
      <div className="analysis-table-wrap">
        <table>
          <caption>Comparação financeira por período</caption>
          <thead>
            <tr>
              <th>Indicador</th>
              <th>Anterior</th>
              <th>Atual</th>
              <th>Diferença</th>
              <th>Variação</th>
            </tr>
          </thead>
          <tbody>
            {data.changes
              .filter((c) => ["income", "expense", "result"].includes(c.kind))
              .map((c) => (
                <tr key={c.kind}>
                  <th>{c.name}</th>
                  <td>{money(c.previousCents, data.currency)}</td>
                  <td>{money(c.currentCents, data.currency)}</td>
                  <td>{money(c.deltaCents, data.currency)}</td>
                  <td>{percentage(c.percentageChange)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="analysis-footnote">
        Percentual sobre o valor absoluto anterior. Quando a base anterior é
        zero e há mudança, o percentual não se aplica. Uma alta nas despesas não
        significa melhora financeira.
      </p>
    </section>
  );
}
function Evolution({ data }: { data: FinancialAnalysis }) {
  const max = Math.max(
    1,
    ...data.series.flatMap((p) => [
      Math.abs(p.incomeCents),
      Math.abs(p.expenseCents),
      Math.abs(p.resultCents),
    ]),
  );
  return (
    <section className="analysis-panel">
      <h2>Seu caminho ao longo do tempo</h2>
      <p>
        Para um mês selecionado, mostramos seis meses. Para um intervalo
        personalizado, os dados são agrupados por mês dentro do intervalo.
      </p>
      <div className="analysis-legend">
        <span>● Receitas</span>
        <span>● Despesas</span>
        <span>● Resultado</span>
      </div>
      <div className="analysis-series" aria-hidden="true">
        {data.series.map((p) => (
          <div key={p.from}>
            <div className="analysis-bars">
              {[p.incomeCents, p.expenseCents, p.resultCents].map((v, i) => (
                <span
                  key={i}
                  className={`analysis-bar bar-${i} ${v < 0 ? "negative" : ""}`}
                  style={{
                    height: `${Math.max(2, (Math.abs(v) / max) * 145)}px`,
                  }}
                  title={money(v, data.currency)}
                />
              ))}
            </div>
            <small>
              {p.from.slice(5, 7)}/{p.from.slice(0, 4)}
            </small>
          </div>
        ))}
      </div>
      <div className="analysis-table-wrap">
        <table>
          <caption>Valores da evolução financeira — {data.currency}</caption>
          <thead>
            <tr>
              <th>Período</th>
              <th>Receitas</th>
              <th>Despesas</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {data.series.map((p) => (
              <tr key={p.from}>
                <th>
                  {dateLabel(p.from)} a {dateLabel(p.to)}
                </th>
                <td>{money(p.incomeCents, data.currency)}</td>
                <td>{money(p.expenseCents, data.currency)}</td>
                <td>{money(p.resultCents, data.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="analysis-footnote">
        Barras hachuradas indicam valores negativos. Os valores com sinal estão
        na tabela.
      </p>
    </section>
  );
}
