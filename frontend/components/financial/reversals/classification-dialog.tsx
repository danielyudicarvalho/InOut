"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import {
  canCorrectClassification,
  classificationChoices,
  displayDate,
  historyKind,
  money,
} from "@inout/finance";
import { AuxiliarySelector } from "../selectors/auxiliary-selector";
import { useClassification } from "../../../lib/finance/use-classification";
export function ClassificationDialog({
  household,
  transactionId,
  onClose,
  onSaved,
}: {
  household: string;
  transactionId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const state = useClassification(household, transactionId),
    ref = useRef<HTMLDialogElement>(null);
  const saving = state.status === "saving",
    pending = state.status === "uncertain";
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  useEffect(() => {
    if (state.status === "success") onSaved();
  }, [state.status, onSaved]);
  const options = state.options,
    detail = options?.detail,
    choices = options ? classificationChoices(options) : null;
  const editable = !!detail && canCorrectClassification(detail);
  return (
    <dialog
      ref={ref}
      className="aux-dialog classification-dialog"
      aria-labelledby="classification-title"
      onCancel={(e) => {
        if (saving) e.preventDefault();
        else onClose();
      }}
    >
      <div className="aux-content">
        <header>
          <div>
            <h2 id="classification-title">Corrigir classificação</h2>
            <p>Ajuste as informações deste lançamento.</p>
          </div>
          <button
            type="button"
            disabled={saving}
            aria-label="Fechar correção"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <Image
          className="classification-art"
          src="/images/pipo-classification.webp"
          alt=""
          width={190}
          height={125}
        />
        {state.status === "loading" && (
          <p role="status">Carregando classificação…</p>
        )}
        {state.notice && <p role="alert">{state.notice}</p>}
        {state.status === "error" && (
          <button onClick={state.retry}>Tentar novamente</button>
        )}
        {detail && (
          <div className="classification-summary">
            <strong>
              {historyKind(detail)} · {money(detail.amount, detail.currency)}
            </strong>
            <small>
              {detail.postings[0].accountName} · {displayDate(detail.date)}
            </small>
          </div>
        )}
        {detail && !editable && !pending && (
          <p>
            Este lançamento não pode ser corrigido. Apenas entradas e saídas
            registradas permitem alterar a classificação.
          </p>
        )}
        {detail && choices && (editable || pending) && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void state.submit();
            }}
          >
            <label>
              Categoria
              <AuxiliarySelector
                title="Categoria"
                value={state.fields.categoryId}
                items={choices.categories}
                disabled={saving || pending}
                onChange={(v) => state.edit("categoryId", v)}
              />
            </label>
            {detail.kind === "income" && (
              <label>
                Fonte de renda (opcional)
                <AuxiliarySelector
                  title="Fonte de renda"
                  value={state.fields.sourceId}
                  items={choices.sources}
                  disabled={saving || pending}
                  onChange={(v) => state.edit("sourceId", v)}
                />
                <small>
                  Use uma fonte para identificar de onde veio a receita.
                </small>
              </label>
            )}
            <label>
              Descrição
              <textarea
                aria-label="Descrição do lançamento"
                maxLength={500}
                value={state.fields.description}
                disabled={saving || pending}
                onChange={(e) => state.edit("description", e.target.value)}
              />
            </label>
            <p className="transaction-help">
              As alterações preservam o valor, a conta e a data do lançamento.
            </p>
            <footer>
              <button type="button" disabled={saving} onClick={onClose}>
                {pending ? "Fechar sem descartar tentativa" : "Cancelar"}
              </button>
              <button className="primary" type="submit" disabled={saving}>
                {saving
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
