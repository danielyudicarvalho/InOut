"use client";
import { useState } from "react";
import Link from "next/link";
import { displayDate, historyKind, money } from "@inout/finance";
import { useLedgerHistory } from "../lib/finance/use-ledger-history";
import { PeriodPicker } from "./period-picker";
export function AccountActivity({
  household,
  period,
  accountId,
  currency,
  hidden,
  onPeriod,
}: {
  household: string;
  period: string;
  accountId: string;
  currency: string;
  hidden: boolean;
  onPeriod: (value: string) => void;
}) {
  const history = useLedgerHistory(household, period, { accountId }, 0);
  const [picker, setPicker] = useState(false);
  const href = (path: string, extra: Record<string, string> = {}) =>
    `${path}?${new URLSearchParams({ household, period, currency, accountId, ...extra })}`;
  return (
    <section
      className="account-activity"
      aria-labelledby="account-activity-title"
    >
      <div className="account-quick-actions">
        {[
          ["income", "＋ Entrada"],
          ["expense", "− Saída"],
          ["transfer", "⇄ Transferência"],
        ].map(([kind, label]) => (
          <Link key={kind} href={href("/novo-registro", { kind })}>
            {label}
          </Link>
        ))}
      </div>
      <div className="dashboard-section-heading">
        <h2 id="account-activity-title">Movimentações do período</h2>
        <button onClick={() => setPicker(true)}>Selecionar período</button>
      </div>
      {history.loading ? (
        <p role="status">Carregando movimentações…</p>
      ) : history.error ? (
        <div role="alert">
          <p>{history.error}</p>
          <button onClick={history.retry}>Tentar novamente</button>
        </div>
      ) : history.items.length === 0 ? (
        <p>Nenhuma movimentação nesta conta no período selecionado.</p>
      ) : (
        <ul className="account-activity-list">
          {history.items.slice(0, 5).map((item, index) => (
            <li key={`${item.transactionId}:${index}`}>
              <Link
                href={href("/lancamento", { transaction: item.transactionId })}
              >
                <span>
                  <strong>{item.description}</strong>
                  <small>
                    {displayDate(item.date)} · {historyKind(item)} ·{" "}
                    {item.status === "reversed" ? "Estornado" : "Registrado"}
                  </small>
                  <small>
                    {item.category}
                    {item.source ? ` · ${item.source}` : ""}
                  </small>
                </span>
                <strong className={item.amount < 0 ? "dashboard-negative" : ""}>
                  {hidden ? "••••" : money(item.amount, item.currency)} ›
                </strong>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href={href("/lancamentos")}>Ver extrato completo →</Link>
      {picker ? (
        <PeriodPicker
          value={period}
          onClose={() => setPicker(false)}
          onApply={(value) => {
            onPeriod(value);
            setPicker(false);
          }}
        />
      ) : null}
    </section>
  );
}
