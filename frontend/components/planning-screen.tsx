"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  createFinanceRepository,
  financeMessage,
  money,
  parseMoneyInput,
  parsePeriod,
  periodLabel,
  type PlanningAgendaItem,
  type PlanningBudget,
  type PlanningBudgetDetail,
  type PlanningForecast,
  type PlanningForecastComparison,
  type PlanningGoal,
  type PlanningGoalDetail,
  type PlanningProject,
} from "@inout/finance";
import { getAuthClient } from "../lib/auth/composition";
import { useFinancialHome } from "../lib/finance/use-financial-home";
import "./analysis.css";
import "./planning.css";

export type PlanningView =
  | "hub"
  | "budgets"
  | "goals"
  | "projects"
  | "recurring"
  | "agenda"
  | "forecasts";

const copy = {
  hub: ["Planejamento", "Orçamentos, metas, projetos e o que se repete."],
  budgets: ["Orçamentos", "Limite, gasto e o que ainda resta no período."],
  goals: ["Metas", "Ativas e encerradas, com a origem de cada aporte."],
  projects: ["Projetos", "O plano e os lançamentos associados, lado a lado."],
  recurring: ["Recorrências", "Planos mensais, prévia e situação."],
  agenda: ["Agenda", "O que está previsto, realizado ou pendente."],
  forecasts: ["Previsões", "O que foi previsto, as premissas e o realizado."],
} as const;

const art = {
  hub: [
    "/images/pipo-budgets.webp",
    "Pipo organiza moedas em potes com folhas",
  ],
  budgets: [
    "/images/pipo-budgets.webp",
    "Pipo organiza moedas em potes com folhas",
  ],
  goals: [
    "/images/pipo-goals.webp",
    "Pipo rega um broto que cresce até uma bandeira",
  ],
  projects: [
    "/images/pipo-projects.webp",
    "Pipo planeja uma viagem sobre um mapa de folhas",
  ],
  recurring: [
    "/images/pipo-recurring.webp",
    "Pipo acompanha brotos que se repetem no calendário",
  ],
  agenda: [
    "/images/pipo-agenda.webp",
    "Pipo confere a agenda com um carimbo de folha",
  ],
  forecasts: [
    "/images/pipo-forecast.webp",
    "Pipo compara brotos previstos e brotos já crescidos",
  ],
} as const;

const cards = [
  [
    "orcamentos",
    "Orçamentos e limites",
    "Definir, acompanhar e ver o que consumiu o limite.",
    "budgets",
  ],
  ["metas", "Metas", "Criar, aportar, desfazer e encerrar.", "goals"],
  [
    "projetos",
    "Projetos financeiros",
    "Planejar e comparar com os lançamentos.",
    "projects",
  ],
  [
    "recorrencias",
    "Recorrências",
    "Criar um plano e alterar a situação.",
    "recurring",
  ],
  [
    "agenda",
    "Agenda financeira",
    "Ver a data prevista e registrar a realização.",
    "agenda",
  ],
  [
    "previsoes",
    "Previsões",
    "Saldo projetado, premissas e realizado.",
    "forecasts",
  ],
] as const;

function repository() {
  return createFinanceRepository({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
    getToken: async () => {
      const { data } = await getAuthClient().auth.getSession();
      return data.session?.access_token ?? null;
    },
  });
}

export function PlanningScreen({ view }: { view: PlanningView }) {
  const p = useSearchParams();
  const home = useFinancialHome({
    initialHouseholdId: p.get("household") ?? "",
    initialPeriod: p.get("period") ?? "",
  });
  const query = new URLSearchParams({
    household: home.householdId,
    period: home.period,
  }).toString();
  const href = (path: string) => `${path}?${query}`;
  const ready = home.status === "ready" && home.householdId && home.period;
  return (
    <main className="analysis-shell">
      <aside className="analysis-sidebar">
        <Link className="analysis-brand" href={href("/inicio")}>
          ✿ Ninho
        </Link>
        <nav aria-label="Navegação principal">
          <Link href={href("/inicio")}>Início</Link>
          <Link href={href("/analises")}>Análises</Link>
          <Link href={href("/lancamentos")}>Lançamentos</Link>
          <Link aria-current="page" href={href("/planejamento")}>
            Planejamento
          </Link>
        </nav>
        <p>Um plano da casa, sem apagar o que já foi lançado.</p>
      </aside>
      <div className="analysis-body">
        <header className="analysis-top">
          <Link href={href(view === "hub" ? "/inicio" : "/planejamento")}>
            ← {view === "hub" ? "Início" : "Planejamento"}
          </Link>
          <span>{home.period ? periodLabel(home.period) : "Período"}</span>
        </header>
        <section className="analysis-hero planning-hero">
          <div>
            <p className="analysis-eyebrow">CUIDAR, ENTENDER, PLANEJAR</p>
            <h1>{copy[view][0]}</h1>
            <p>{copy[view][1]}</p>
          </div>
          <Image
            src={art[view][0]}
            width={320}
            height={180}
            alt={art[view][1]}
            priority
          />
        </section>
        {!ready ? (
          <p role="status">{home.notice || "Carregando a residência…"}</p>
        ) : (
          <PlanningBody
            view={view}
            household={home.householdId}
            period={home.period}
            href={href}
            item={p.get("item") ?? ""}
          />
        )}
      </div>
    </main>
  );
}

function PlanningBody({
  view,
  household,
  period,
  href,
  item,
}: {
  view: PlanningView;
  household: string;
  period: string;
  href: (path: string) => string;
  item: string;
}) {
  if (view === "hub") {
    return (
      <div className="planning-grid">
        {cards.map(([path, title, text, key]) => (
          <Link
            className="planning-card"
            href={href(`/planejamento/${path}`)}
            key={path}
          >
            <Image src={art[key][0]} width={320} height={180} alt="" />
            <strong>{title}</strong>
            <span className="planning-muted">{text}</span>
          </Link>
        ))}
      </div>
    );
  }
  if (view === "budgets")
    return (
      <Budgets household={household} period={period} href={href} item={item} />
    );
  if (view === "goals")
    return (
      <Goals household={household} period={period} href={href} item={item} />
    );
  if (view === "projects")
    return (
      <Projects household={household} period={period} href={href} item={item} />
    );
  if (view === "recurring")
    return (
      <Recurring
        household={household}
        period={period}
        href={href}
        item={item}
      />
    );
  if (view === "agenda")
    return <Agenda household={household} period={period} href={href} />;
  return (
    <Forecasts household={household} period={period} href={href} item={item} />
  );
}

function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; notice: string }>({
    data: null,
    notice: "",
  });
  useEffect(() => {
    const controller = new AbortController();
    load()
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, notice: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ data: null, notice: financeMessage(error) });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

function Budgets({
  household,
  period,
  href,
  item,
}: {
  household: string;
  period: string;
  href: (path: string) => string;
  item: string;
}) {
  const bounds = parsePeriod(period);
  const [revision, setRevision] = useState(0);
  const [limit, setLimit] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("BRL");
  const [notice, setNotice] = useState("");
  const list = useAsync(
    () => repository().budgets(household, bounds.from, bounds.to),
    [household, bounds.from, bounds.to, revision],
  );
  const options = useAsync(
    () => repository().recordOptions(household),
    [household],
  );
  const detail = useAsync(
    () => (item ? repository().budget(household, item) : Promise.resolve(null)),
    [household, item, revision],
  );
  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      await repository().setBudget(
        household,
        {
          id: item || null,
          categoryId,
          periodStart: bounds.from,
          periodEnd: bounds.to,
          limitCents: parseMoneyInput(limit),
          currency: budgetCurrency,
        },
        crypto.randomUUID(),
      );
      setLimit("");
      setNotice("Limite salvo.");
      setRevision((value) => value + 1);
    } catch (error) {
      setNotice(financeMessage(error));
    }
  }
  const currencyCode = (row: PlanningBudget) => row.currency ?? "BRL";
  return (
    <section className="planning-list">
      <p role="status">{list.notice || notice}</p>
      {(list.data ?? []).map((row) => (
        <article className="planning-panel" key={row.id}>
          <div className="planning-row">
            <div>
              <h2>{row.categoryName}</h2>
              <p className="planning-muted">
                {row.currency ?? "Moeda ainda não definida"}
              </p>
            </div>
            <Link href={`${href("/planejamento/orcamentos")}&item=${row.id}`}>
              Ver detalhe
            </Link>
          </div>
          <p>
            Limite{" "}
            {row.currency ? money(row.limitCents, currencyCode(row)) : "—"}
          </p>
          <p className="planning-out">
            Gasto{" "}
            {row.spentCents == null || !row.currency
              ? "—"
              : money(row.spentCents, row.currency)}
          </p>
          <p>
            Restante{" "}
            {row.remainingCents == null || !row.currency
              ? "—"
              : money(row.remainingCents, row.currency)}
          </p>
        </article>
      ))}
      {detail.data ? (
        <BudgetDetailView detail={detail.data} href={href} />
      ) : null}
      <form className="planning-panel planning-form" onSubmit={save}>
        <h2>{item ? "Editar limite" : "Definir limite"}</h2>
        <label>
          Categoria de despesa
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
          >
            <option value="">Escolher</option>
            {(options.data?.categories ?? [])
              .filter((row) => row.flow === "expense")
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Limite
          <input
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            inputMode="decimal"
            placeholder="150,00"
            required
          />
        </label>
        <label>
          Moeda
          <input
            value={budgetCurrency}
            onChange={(event) =>
              setBudgetCurrency(event.target.value.toUpperCase())
            }
            maxLength={3}
            required
          />
        </label>
        <button type="submit">Salvar limite</button>
      </form>
    </section>
  );
}

function BudgetDetailView({
  detail,
  href,
}: {
  detail: PlanningBudgetDetail;
  href: (path: string) => string;
}) {
  const code = detail.budget.currency ?? "BRL";
  return (
    <article className="planning-panel">
      <h2>Histórico e despesas de {detail.budget.categoryName}</h2>
      {detail.revisions.length === 0 ? (
        <p className="planning-muted">
          Este limite ainda não tem revisões registradas.
        </p>
      ) : (
        <ul>
          {detail.revisions.map((row) => (
            <li key={row.id}>
              {row.previousLimitCents == null
                ? "Definido"
                : `De ${money(row.previousLimitCents, row.currency)}`}{" "}
              para {money(row.limitCents, row.currency)}
            </li>
          ))}
        </ul>
      )}
      <h3>Despesas que consumiram o limite</h3>
      {detail.expenses.length === 0 ? (
        <p className="planning-muted">Nenhuma despesa nesta moeda e período.</p>
      ) : (
        <ul>
          {detail.expenses.map((row) => (
            <li key={row.transactionId}>
              <Link href={`${href("/lancamentos")}&accountId=`}>
                {row.occurredOn}
              </Link>{" "}
              {row.description ?? row.accountName}{" "}
              <span className="planning-out">
                {money(row.amountCents, code)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function Goals({
  household,
  period,
  href,
  item,
}: {
  household: string;
  period: string;
  href: (path: string) => string;
  item: string;
}) {
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [currencyCode, setCurrency] = useState("BRL");
  const [amount, setAmount] = useState("");
  const list = useAsync(
    () => repository().goals(household),
    [household, revision],
  );
  const detail = useAsync(
    () => (item ? repository().goal(household, item) : Promise.resolve(null)),
    [household, item, revision],
  );
  const bounds = parsePeriod(period);
  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      setNotice(done);
      setRevision((value) => value + 1);
    } catch (error) {
      setNotice(financeMessage(error));
    }
  }
  const goals = list.data ?? [];
  const open = goals.filter(
    (row) => row.status === "active" || row.status === "paused",
  );
  const closed = goals.filter(
    (row) => row.status === "completed" || row.status === "archived",
  );
  return (
    <section className="planning-list">
      <p role="status">{list.notice || notice}</p>
      <GoalGroup title="Ativas" rows={open} href={href} />
      <GoalGroup title="Encerradas" rows={closed} href={href} />
      {detail.data ? (
        <GoalDetailView
          detail={detail.data}
          amount={amount}
          setAmount={setAmount}
          onAllocate={() =>
            run(
              () =>
                repository().allocateGoal(
                  household,
                  detail.data!.goal.id,
                  {
                    amountCents: parseMoneyInput(amount),
                    currency: detail.data!.goal.currency,
                    occurredOn: bounds.to,
                    note: null,
                  },
                  crypto.randomUUID(),
                ),
              "Aporte registrado.",
            )
          }
          onReverse={(allocationId) =>
            run(
              () =>
                repository().reverseAllocation(
                  household,
                  detail.data!.goal.id,
                  allocationId,
                  {
                    occurredOn: bounds.to,
                    note: null,
                  },
                  crypto.randomUUID(),
                ),
              "Aporte desfeito.",
            )
          }
          onStatus={(status) =>
            run(
              () =>
                repository().changeGoalStatus(
                  household,
                  detail.data!.goal.id,
                  status,
                  crypto.randomUUID(),
                ),
              "Situação atualizada.",
            )
          }
          onRename={(next) =>
            run(
              () =>
                repository().updateGoal(
                  household,
                  detail.data!.goal.id,
                  {
                    name: next,
                    targetCents: detail.data!.goal.targetCents,
                    targetDate: detail.data!.goal.targetDate,
                  },
                  crypto.randomUUID(),
                ),
              "Meta atualizada.",
            )
          }
        />
      ) : null}
      <form
        className="planning-panel planning-form"
        onSubmit={(event) => {
          event.preventDefault();
          void run(
            () =>
              repository().createGoal(
                household,
                {
                  name,
                  targetCents: parseMoneyInput(target),
                  currency: currencyCode,
                  targetDate: null,
                },
                crypto.randomUUID(),
              ),
            "Meta criada.",
          );
        }}
      >
        <h2>Nova meta</h2>
        <label>
          Nome
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label>
          Valor alvo
          <input
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            inputMode="decimal"
            placeholder="1000,00"
            required
          />
        </label>
        <label>
          Moeda
          <input
            value={currencyCode}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            maxLength={3}
            required
          />
        </label>
        <button type="submit">Criar meta</button>
      </form>
    </section>
  );
}

function GoalGroup({
  title,
  rows,
  href,
}: {
  title: string;
  rows: PlanningGoal[];
  href: (path: string) => string;
}) {
  return (
    <div className="planning-list">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="planning-muted">Nenhuma meta neste grupo.</p>
      ) : (
        rows.map((row) => (
          <article className="planning-panel planning-row" key={row.id}>
            <div>
              <strong>{row.name}</strong>
              <p className="planning-muted">
                {labelStatus(row.status)} · {row.currency ?? "moeda pendente"}
              </p>
              {row.currency ? (
                <p>
                  {money(row.allocatedCents, row.currency)} de{" "}
                  {money(row.targetCents, row.currency)}
                </p>
              ) : null}
            </div>
            <Link href={`${href("/planejamento/metas")}&item=${row.id}`}>
              Detalhe
            </Link>
          </article>
        ))
      )}
    </div>
  );
}

function GoalDetailView({
  detail,
  amount,
  setAmount,
  onAllocate,
  onReverse,
  onStatus,
  onRename,
}: {
  detail: PlanningGoalDetail;
  amount: string;
  setAmount: (value: string) => void;
  onAllocate: () => void;
  onReverse: (id: string) => void;
  onStatus: (status: string) => void;
  onRename: (name: string) => void;
}) {
  const goal = detail.goal;
  const [name, setName] = useState(goal.name);
  const code = goal.currency ?? "BRL";
  return (
    <article className="planning-panel">
      <h2>Origem do progresso</h2>
      <form
        className="planning-form"
        onSubmit={(event) => {
          event.preventDefault();
          onRename(name);
        }}
      >
        <label>
          Nome
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button type="submit">Salvar nome</button>
      </form>
      <div className="planning-actions">
        <button type="button" onClick={() => onStatus("paused")}>
          Pausar
        </button>
        <button type="button" onClick={() => onStatus("active")}>
          Retomar
        </button>
        <button type="button" onClick={() => onStatus("completed")}>
          Concluir
        </button>
        <button type="button" onClick={() => onStatus("archived")}>
          Cancelar
        </button>
      </div>
      {goal.currency && goal.status === "active" ? (
        <div className="planning-form">
          <label>
            Aporte
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
            />
          </label>
          <button type="button" onClick={onAllocate}>
            Registrar aporte
          </button>
        </div>
      ) : null}
      <ul>
        {detail.allocations.map((row) => (
          <li key={row.id}>
            {row.occurredOn} · {row.kind === "reversal" ? "estorno" : "aporte"}{" "}
            {money(row.amountCents, code)}
            {row.note ? ` · ${row.note}` : ""}
            {row.kind === "contribution" &&
            !detail.allocations.some((other) => other.reversalOf === row.id) ? (
              <button type="button" onClick={() => onReverse(row.id)}>
                Desfazer
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </article>
  );
}

function Projects({
  household,
  period,
  href,
  item,
}: {
  household: string;
  period: string;
  href: (path: string) => string;
  item: string;
}) {
  const bounds = parsePeriod(period);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currencyCode, setCurrency] = useState("BRL");
  const [transactionId, setTransaction] = useState("");
  const list = useAsync(
    () => repository().projects(household),
    [household, revision],
  );
  const detail = useAsync(
    () =>
      item ? repository().project(household, item) : Promise.resolve(null),
    [household, item, revision],
  );
  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      setNotice(done);
      setRevision((value) => value + 1);
    } catch (error) {
      setNotice(financeMessage(error));
    }
  }
  return (
    <section className="planning-list">
      <p role="status">{list.notice || notice}</p>
      {(list.data ?? []).map((row) => (
        <article className="planning-panel planning-row" key={row.id}>
          <div>
            <h2>{row.name}</h2>
            <p className="planning-muted">
              {labelStatus(row.status)} · {row.currency}
            </p>
            <Comparison row={row} />
          </div>
          <Link href={`${href("/planejamento/projetos")}&item=${row.id}`}>
            Detalhe
          </Link>
        </article>
      ))}
      {detail.data ? (
        <article className="planning-panel">
          <h2>{detail.data.name}</h2>
          <Comparison row={detail.data} />
          <h3>Planejamento</h3>
          <ul>
            {detail.data.lines.map((line) => (
              <li key={line.id}>
                {line.name} · {line.flow === "income" ? "entrada" : "saída"}{" "}
                {money(line.amountCents, detail.data!.currency)}
              </li>
            ))}
          </ul>
          {detail.data.status === "active" ? (
            <ProjectEditor
              key={`${detail.data.id}-${revision}`}
              project={detail.data}
              onSave={(body) =>
                run(
                  () =>
                    repository().updateProject(
                      household,
                      detail.data!.id,
                      body,
                      crypto.randomUUID(),
                    ),
                  "Projeto atualizado.",
                )
              }
            />
          ) : null}
          <h3>Lançamentos associados</h3>
          <ul>
            {detail.data.movements.map((row) => (
              <li key={row.transactionId}>
                <Link href={`${href("/lancamentos")}`}>{row.occurredOn}</Link>{" "}
                {row.description ?? "Lançamento"}
                {detail.data!.status === "active" ? (
                  <button
                    type="button"
                    onClick={() =>
                      run(
                        () =>
                          repository().unlinkProjectMovement(
                            household,
                            detail.data!.id,
                            row.transactionId,
                            crypto.randomUUID(),
                          ),
                        "Associação removida.",
                      )
                    }
                  >
                    Remover
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {detail.data.status === "active" ? (
            <div className="planning-form">
              <label>
                Lançamento
                <input
                  value={transactionId}
                  onChange={(event) => setTransaction(event.target.value)}
                  placeholder="Identificador do lançamento"
                />
              </label>
              <div className="planning-actions">
                <button
                  type="button"
                  onClick={() =>
                    run(
                      () =>
                        repository().linkProjectMovement(
                          household,
                          detail.data!.id,
                          transactionId,
                          crypto.randomUUID(),
                        ),
                      "Lançamento associado.",
                    )
                  }
                >
                  Associar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    run(
                      () =>
                        repository().closeProject(
                          household,
                          detail.data!.id,
                          crypto.randomUUID(),
                        ),
                      "Projeto encerrado.",
                    )
                  }
                >
                  Encerrar
                </button>
              </div>
            </div>
          ) : (
            <p className="planning-muted">
              Projeto encerrado. O plano e os vínculos permanecem.
            </p>
          )}
        </article>
      ) : null}
      <form
        className="planning-panel planning-form"
        onSubmit={(event) => {
          event.preventDefault();
          const lineId = crypto.randomUUID();
          void run(
            () =>
              repository().createProject(
                household,
                {
                  name,
                  currency: currencyCode,
                  plannedCents: parseMoneyInput(amount),
                  startsOn: bounds.from,
                  endsOn: bounds.to,
                  notes: null,
                  lines: [
                    {
                      id: lineId,
                      name,
                      flow: "expense",
                      amountCents: parseMoneyInput(amount),
                    },
                  ],
                },
                crypto.randomUUID(),
              ),
            "Projeto criado.",
          );
        }}
      >
        <h2>Novo projeto</h2>
        <label>
          Nome
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label>
          Previsto
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            required
          />
        </label>
        <label>
          Moeda
          <input
            value={currencyCode}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            maxLength={3}
            required
          />
        </label>
        <button type="submit">Criar projeto</button>
      </form>
    </section>
  );
}

function ProjectEditor({
  project,
  onSave,
}: {
  project: PlanningProject;
  onSave: (body: { [key: string]: unknown }) => void;
}) {
  const [name, setName] = useState(project.name);
  const [amount, setAmount] = useState(
    (project.plannedCents / 100).toFixed(2).replace(".", ","),
  );
  const [notes, setNotes] = useState(project.notes ?? "");
  return (
    <form
      className="planning-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          name,
          plannedCents: parseMoneyInput(amount),
          startsOn: project.startsOn,
          endsOn: project.endsOn,
          notes: notes.trim() || null,
          lines: project.lines,
        });
      }}
    >
      <h3>Editar</h3>
      <label>
        Nome
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>
      <label>
        Previsto
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          required
        />
      </label>
      <label>
        Notas
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={500}
        />
      </label>
      <button type="submit">Salvar projeto</button>
    </form>
  );
}

function Comparison({ row }: { row: PlanningProject }) {
  const code = row.currency;
  return (
    <p>
      Previsto{" "}
      <span className="planning-out">
        {money(row.comparison.plannedExpenseCents, code)}
      </span>
      {" · "}Realizado{" "}
      <span className="planning-out">
        {money(row.comparison.actualExpenseCents, code)}
      </span>
      {" · "}Entradas previstas{" "}
      <span className="planning-in">
        {money(row.comparison.plannedIncomeCents, code)}
      </span>
      {" · "}Entradas realizadas{" "}
      <span className="planning-in">
        {money(row.comparison.actualIncomeCents, code)}
      </span>
    </p>
  );
}

function Recurring({
  household,
  period,
  href,
  item,
}: {
  household: string;
  period: string;
  href: (path: string) => string;
  item: string;
}) {
  const bounds = parsePeriod(period);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("5");
  const [flow, setFlow] = useState("expense");
  const [accountId, setAccount] = useState("");
  const [categoryId, setCategory] = useState("");
  const options = useAsync(
    () => repository().recordOptions(household),
    [household],
  );
  const list = useAsync(
    () => repository().recurringPlans(household),
    [household, revision],
  );
  const preview = useAsync(
    () =>
      item
        ? repository().recurringPreview(household, item, bounds.from)
        : Promise.resolve(null),
    [household, item, bounds.from, revision],
  );
  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      setNotice(done);
      setRevision((value) => value + 1);
    } catch (error) {
      setNotice(financeMessage(error));
    }
  }
  const selected = (list.data ?? []).find((row) => row.id === item);
  return (
    <section className="planning-list">
      <p role="status">{list.notice || notice}</p>
      <p className="planning-muted">
        O valor, o dia e o nome ficam como foram criados. Dá para pausar,
        retomar ou arquivar.
      </p>
      {(list.data ?? []).map((row) => (
        <article className="planning-panel planning-row" key={row.id}>
          <div>
            <h2>{row.name}</h2>
            <p
              className={row.flow === "income" ? "planning-in" : "planning-out"}
            >
              {row.flow === "income" ? "Entrada" : "Saída"}{" "}
              {money(row.amountCents, row.currency)} · dia {row.dayOfMonth}
            </p>
            <p className="planning-muted">{labelStatus(row.status)}</p>
          </div>
          <Link href={`${href("/planejamento/recorrencias")}&item=${row.id}`}>
            Prévia
          </Link>
        </article>
      ))}
      {selected ? (
        <article className="planning-panel">
          <h2>Prévia de {selected.name}</h2>
          <ul>
            {(preview.data ?? []).map((dayOn) => (
              <li key={dayOn}>{dayOn}</li>
            ))}
          </ul>
          <div className="planning-actions">
            <button
              type="button"
              onClick={() =>
                run(
                  () =>
                    repository().changeRecurringStatus(
                      household,
                      selected.id,
                      "paused",
                    ),
                  "Plano pausado.",
                )
              }
            >
              Pausar
            </button>
            <button
              type="button"
              onClick={() =>
                run(
                  () =>
                    repository().changeRecurringStatus(
                      household,
                      selected.id,
                      "active",
                    ),
                  "Plano retomado.",
                )
              }
            >
              Retomar
            </button>
            <button
              type="button"
              onClick={() =>
                run(
                  () =>
                    repository().changeRecurringStatus(
                      household,
                      selected.id,
                      "archived",
                    ),
                  "Plano arquivado.",
                )
              }
            >
              Arquivar
            </button>
          </div>
        </article>
      ) : null}
      <form
        className="planning-panel planning-form"
        onSubmit={(event) => {
          event.preventDefault();
          const account = options.data?.accounts.find(
            (row) => row.id === accountId,
          );
          void run(
            () =>
              repository().createRecurringPlan(
                household,
                {
                  name,
                  flow,
                  accountId,
                  categoryId,
                  incomeSourceId: null,
                  amountCents: parseMoneyInput(amount),
                  currency: account?.currency ?? "BRL",
                  dayOfMonth: Number(day),
                  startsOn: bounds.from,
                  endsOn: null,
                },
                crypto.randomUUID(),
              ),
            "Plano criado.",
          );
        }}
      >
        <h2>Novo plano</h2>
        <label>
          Nome
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label>
          Fluxo
          <select
            value={flow}
            onChange={(event) => setFlow(event.target.value)}
          >
            <option value="expense">Saída</option>
            <option value="income">Entrada</option>
          </select>
        </label>
        <label>
          Conta
          <select
            value={accountId}
            onChange={(event) => setAccount(event.target.value)}
            required
          >
            <option value="">Escolher</option>
            {(options.data?.accounts ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Categoria
          <select
            value={categoryId}
            onChange={(event) => setCategory(event.target.value)}
            required
          >
            <option value="">Escolher</option>
            {(options.data?.categories ?? [])
              .filter((row) => row.flow === flow)
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Valor
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            required
          />
        </label>
        <label>
          Dia do mês
          <input
            value={day}
            onChange={(event) => setDay(event.target.value)}
            inputMode="numeric"
            required
          />
        </label>
        <button type="submit">Criar plano</button>
      </form>
    </section>
  );
}

function Agenda({
  household,
  period,
  href,
}: {
  household: string;
  period: string;
  href: (path: string) => string;
}) {
  const bounds = parsePeriod(period);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const list = useAsync(
    () => repository().agenda(household, bounds.from, bounds.to),
    [household, bounds.from, bounds.to, revision],
  );
  async function realize(row: PlanningAgendaItem) {
    try {
      await repository().realizeOccurrence(
        household,
        row.planId,
        row.scheduledOn,
        crypto.randomUUID(),
      );
      setNotice("Realização registrada.");
      setRevision((value) => value + 1);
    } catch (error) {
      setNotice(financeMessage(error));
    }
  }
  return (
    <section className="planning-list">
      <p role="status">{list.notice || notice}</p>
      {(list.data ?? []).length === 0 ? (
        <p className="planning-muted">Nenhuma ocorrência neste período.</p>
      ) : (
        (list.data ?? []).map((row) => (
          <article
            className="planning-panel planning-row"
            key={`${row.planId}:${row.scheduledOn}`}
          >
            <div>
              <h2>{row.planName}</h2>
              <p
                className={
                  row.flow === "income" ? "planning-in" : "planning-out"
                }
              >
                {row.scheduledOn} ·{" "}
                {row.flow === "income" ? "Entrada" : "Saída"}{" "}
                {money(row.amountCents, row.currency)}
              </p>
              <p className="planning-muted">
                {row.state === "realized"
                  ? "Realizada"
                  : row.state === "overdue"
                    ? "Pendente"
                    : "Prevista"}
              </p>
            </div>
            {row.transactionId ? (
              <Link href={`${href("/lancamentos")}`}>Ver lançamento</Link>
            ) : (
              <button type="button" onClick={() => realize(row)}>
                Registrar realização
              </button>
            )}
          </article>
        ))
      )}
    </section>
  );
}

function Forecasts({
  household,
  period,
  href,
  item,
}: {
  household: string;
  period: string;
  href: (path: string) => string;
  item: string;
}) {
  const bounds = parsePeriod(period);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [accountId, setAccount] = useState("");
  const [months, setMonths] = useState("3");
  const options = useAsync(
    () => repository().recordOptions(household),
    [household],
  );
  const list = useAsync(
    () => repository().forecasts(household),
    [household, revision],
  );
  const comparison = useAsync(
    () =>
      item
        ? repository().compareForecast(household, item)
        : Promise.resolve(null),
    [household, item, revision],
  );
  const selected = (list.data ?? []).find((row) => row.id === item);
  return (
    <section className="planning-list">
      <p role="status">{list.notice || notice}</p>
      {(list.data ?? []).map((row) => (
        <article className="planning-panel planning-row" key={row.id}>
          <div>
            <h2>A partir de {row.asOf}</h2>
            <p className="planning-muted">
              {row.months} meses · saldo inicial{" "}
              {money(row.openingBalanceCents, row.currency)}
            </p>
          </div>
          <Link href={`${href("/planejamento/previsoes")}&item=${row.id}`}>
            Detalhe
          </Link>
        </article>
      ))}
      {selected ? (
        <ForecastDetail forecast={selected} comparison={comparison.data} />
      ) : null}
      <form
        className="planning-panel planning-form"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await repository().createForecast(
              household,
              {
                accountId,
                asOf: bounds.from,
                months: Number(months),
              },
              crypto.randomUUID(),
            );
            setNotice("Previsão salva.");
            setRevision((value) => value + 1);
          } catch (error) {
            setNotice(financeMessage(error));
          }
        }}
      >
        <h2>Nova previsão</h2>
        <label>
          Conta
          <select
            value={accountId}
            onChange={(event) => setAccount(event.target.value)}
            required
          >
            <option value="">Escolher</option>
            {(options.data?.accounts ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Meses
          <input
            value={months}
            onChange={(event) => setMonths(event.target.value)}
            inputMode="numeric"
            required
          />
        </label>
        <button type="submit">Calcular e salvar</button>
      </form>
    </section>
  );
}

function ForecastDetail({
  forecast,
  comparison,
}: {
  forecast: PlanningForecast;
  comparison: PlanningForecastComparison[] | null;
}) {
  return (
    <article className="planning-panel">
      <h2>Premissas guardadas</h2>
      {forecast.assumptions.length === 0 ? (
        <p className="planning-muted">
          Esta previsão guarda os identificadores dos planos, sem a cópia das
          condições.
        </p>
      ) : (
        <ul>
          {forecast.assumptions.map((row) => (
            <li key={row.planId}>
              {row.name} · dia {row.dayOfMonth} ·{" "}
              {money(row.amountCents, row.currency)} · {labelStatus(row.status)}
            </li>
          ))}
        </ul>
      )}
      <h3>Previsto e realizado</h3>
      <ul>
        {(comparison ?? []).map((row) => (
          <li key={row.month}>
            {row.month}: previsto{" "}
            {money(row.expectedIncomeCents, forecast.currency)} /{" "}
            {money(row.expectedExpenseCents, forecast.currency)}
            {" · "}realizado {money(row.actualIncomeCents, forecast.currency)} /{" "}
            {money(row.actualExpenseCents, forecast.currency)}
            {" · "}saldo projetado{" "}
            {money(row.projectedBalanceCents, forecast.currency)}
          </li>
        ))}
      </ul>
      <h3>Contribuições de cada mês</h3>
      <ul>
        {forecast.points.flatMap((point) =>
          point.contributions.map((row) => (
            <li key={`${point.month}:${row.planId}`}>
              {point.month} · {row.scheduledOn} ·{" "}
              {money(row.amountCents, row.currency)}
            </li>
          )),
        )}
      </ul>
    </article>
  );
}

function labelStatus(status: string) {
  return (
    {
      active: "Ativa",
      paused: "Pausada",
      completed: "Concluída",
      archived: "Cancelada",
      closed: "Encerrada",
    }[status] ?? status
  );
}
