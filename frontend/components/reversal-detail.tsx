import Link from "next/link";
import {
  ArrowBendUpLeft,
  ArrowLeft,
  ArrowSquareOut,
  CalendarBlank,
  ChatText,
  CheckCircle,
  Clock,
  Equals,
  Info,
  Minus,
  Plus,
  ShoppingCart,
  User,
  Wallet,
} from "@phosphor-icons/react";
import {
  money,
  displayDate,
  historyKind,
  reversalReconciliation,
  type TransactionDetail,
} from "@inout/finance";

export function ReversalDetail({
  detail,
  original,
  originalHref,
  backHref,
}: {
  detail: TransactionDetail;
  original: TransactionDetail;
  originalHref: string;
  backHref: string;
}) {
  const effects = reversalReconciliation(detail, original);
  const signed = (amount: number, currency: string) =>
    `${amount > 0 ? "+ " : amount < 0 ? "− " : ""}${money(Math.abs(amount), currency)}`;
  return (
    <>
      <section className="transaction-card reversal-summary-card">
        <div className="reversal-summary">
          <span className="reversal-cart">
            <ShoppingCart size={30} />
          </span>
          <div className="reversal-summary-copy">
            <h2>Estorno de {original.description}</h2>
            <div className="reversal-badges">
              <span>
                <ArrowBendUpLeft /> Estorno
              </span>
              <span>
                <CheckCircle weight="fill" /> Registrado
              </span>
            </div>
            <p className="reversal-account">
              <Wallet size={16} />{" "}
              {detail.postings.map((p) => p.accountName).join(" · ")} ·{" "}
              {detail.currency}
            </p>
          </div>
          {effects.length === 1 && (
            <div className="reversal-compensation">
              <small>Compensação na conta</small>
              <strong
                className={
                  detail.amount < 0 ? "transaction-out" : "transaction-in"
                }
              >
                {signed(detail.amount, detail.currency)}
              </strong>
            </div>
          )}
        </div>
        <p className="reversal-info">
          <Info weight="fill" />{" "}
          {effects.length > 1
            ? "Este estorno compensa os dois lados da transferência."
            : original.amount < 0
              ? "Este valor compensa a saída original. Não é uma nova receita."
              : "Este valor compensa a entrada original. Não é uma nova despesa."}
        </p>
      </section>
      <section className="transaction-card reversal-detail-original">
        <div className="reversal-section-heading">
          <h2>Lançamento original</h2>
          <Link href={originalHref}>
            Ver lançamento original <ArrowSquareOut />
          </Link>
        </div>
        <Link className="reversal-detail-original-row" href={originalHref}>
          <ShoppingCart size={26} />
          <div>
            <strong>{original.description}</strong>
            <small>
              {historyKind({ kind: original.kind })} ·{" "}
              {displayDate(original.date)}
            </small>
          </div>
          <strong
            className={
              original.amount < 0 ? "transaction-out" : "transaction-in"
            }
          >
            {signed(original.amount, original.currency)}
          </strong>
          <span className="transaction-status reversed">Estornado</span>
          <ArrowSquareOut size={17} />
        </Link>
      </section>
      <section className="transaction-card reversal-reconciliation">
        <h2>Conciliação do estorno</h2>
        {effects.map((effect) => (
          <div key={effect.accountId} className="reversal-detail-effect">
            {effects.length > 1 && (
              <h3>
                {effect.accountName} · {effect.currency}
              </h3>
            )}
            <div className="reversal-equation">
              <div className="reversal-equation-cell">
                <Minus weight="bold" />
                <div>
                  <small>
                    {effect.original < 0
                      ? "Saída original"
                      : "Entrada original"}
                  </small>
                  <strong
                    className={
                      effect.original < 0 ? "transaction-out" : "transaction-in"
                    }
                  >
                    {signed(effect.original, effect.currency)}
                  </strong>
                </div>
              </div>
              <Plus className="reversal-operator" />
              <div className="reversal-equation-cell">
                <Plus weight="bold" />
                <div>
                  <small>Compensação</small>
                  <strong
                    className={
                      effect.compensation < 0
                        ? "transaction-out"
                        : "transaction-in"
                    }
                  >
                    {signed(effect.compensation, effect.currency)}
                  </strong>
                </div>
              </div>
              <Equals className="reversal-operator" />
              <div className="reversal-equation-cell">
                <Equals weight="bold" />
                <div>
                  <small>Efeito líquido</small>
                  <strong>{money(effect.net, effect.currency)}</strong>
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>
      <div className="reversal-metadata">
        <section className="transaction-card">
          <h2>Detalhes do estorno</h2>
          <dl>
            <div>
              <CalendarBlank />
              <dt>Data do estorno</dt>
              <dd>{displayDate(detail.date)}</dd>
            </div>
            <div>
              <ChatText />
              <dt>Motivo</dt>
              <dd>{detail.rawDescription || "Motivo não informado"}</dd>
            </div>
          </dl>
        </section>
        <section className="transaction-card">
          <h2>Auditoria</h2>
          <dl>
            <div>
              <User />
              <dt>Estornado por (usuário)</dt>
              <dd>{detail.createdBy}</dd>
            </div>
            <div>
              <Clock />
              <dt>Registrado em</dt>
              <dd>
                {new Date(detail.postedAt).toLocaleString("pt-BR")}
                <small>Horário do dispositivo</small>
              </dd>
            </div>
          </dl>
        </section>
      </div>
      <p className="reversal-info">
        <Info weight="fill" /> O lançamento original permanece no histórico.
      </p>
      <footer className="transaction-actions reversal-actions">
        <Link className="primary" href={originalHref}>
          <ArrowSquareOut /> Ver lançamento original
        </Link>
        <Link href={backHref}>
          <ArrowLeft /> Voltar ao histórico
        </Link>
      </footer>
    </>
  );
}
