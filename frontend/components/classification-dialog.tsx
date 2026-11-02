"use client";
import { useEffect, useRef } from "react";
import {
  canCorrectClassification,
  classificationChoices,
  type TransactionDetail,
} from "@inout/finance";
import { useClassification } from "../lib/finance/use-classification";
export function ClassificationDialog({
  household,
  transactionId,
  onClose,
  onSaved,
  onConflict,
}: {
  household: string;
  transactionId: string;
  onClose: () => void;
  onSaved: () => void;
  onConflict: (detail: TransactionDetail) => void;
}) {
  const state = useClassification(household, transactionId),
    ref = useRef<HTMLDialogElement>(null);
  const busy = state.status === "saving",
    pending = state.status === "uncertain",
    detail = state.options?.detail;
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  useEffect(() => {
    if (state.status === "success") onSaved();
    else if (
      detail &&
      (state.status === "stale" ||
        (state.status === "ready" && !canCorrectClassification(detail)))
    )
      onConflict(detail);
  }, [state.status, detail, onSaved, onConflict]);
  const choices = state.options ? classificationChoices(state.options) : null;
  return (
    <dialog
      ref={ref}
      className="transaction-dialog classification-dialog"
      aria-labelledby="classification-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <div className="classification-panel">
        <header>
          <h2 id="classification-title">Corrigir classificação</h2>
          <button
            className="transaction-close"
            disabled={busy}
            aria-label="Fechar correção"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <p>
          Altere a categoria, a fonte ou a descrição. O valor, a conta e a data
          são preservados.
        </p>
        {state.status === "loading" && (
          <p role="status">Carregando classificação…</p>
        )}
        {state.notice && <p role="alert">{state.notice}</p>}
        {state.status === "error" && (
          <button onClick={state.retry}>Tentar novamente</button>
        )}
        {detail &&
          choices &&
          ["ready", "saving", "uncertain"].includes(state.status) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void state.submit();
              }}
            >
              <fieldset disabled={busy || pending}>
                <label>
                  Categoria
                  <select
                    required
                    value={state.fields.categoryId}
                    onChange={(e) => state.edit("categoryId", e.target.value)}
                  >
                    <option value="" disabled>
                      Selecione uma categoria
                    </option>
                    {choices.categories.map((c) => (
                      <option key={c.id} value={c.id} disabled={c.disabled}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                {detail.kind === "income" && (
                  <label>
                    Fonte de renda (opcional)
                    <select
                      value={state.fields.sourceId}
                      onChange={(e) => state.edit("sourceId", e.target.value)}
                    >
                      {choices.sources.map((s) => (
                        <option key={s.id} value={s.id} disabled={s.disabled}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Descrição
                  <textarea
                    maxLength={500}
                    value={state.fields.description}
                    onChange={(e) => state.edit("description", e.target.value)}
                  />
                </label>
              </fieldset>
              <footer>
                <button
                  className="transaction-secondary"
                  type="button"
                  disabled={busy}
                  onClick={onClose}
                >
                  {pending ? "Fechar sem descartar tentativa" : "Cancelar"}
                </button>
                <button
                  className="transaction-primary"
                  disabled={busy}
                  type="submit"
                >
                  {busy
                    ? "Salvando…"
                    : pending
                      ? "Verificar mesma tentativa"
                      : "Salvar alterações"}
                </button>
              </footer>
            </form>
          )}
      </div>
    </dialog>
  );
}
