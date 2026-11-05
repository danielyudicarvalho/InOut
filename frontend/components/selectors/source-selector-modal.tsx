"use client";

import { createElement, useEffect, useRef, useState } from "react";
import {
  X,
  MagnifyingGlass,
  Check,
  Plus,
  Briefcase,
  Prohibit,
  Laptop,
  Buildings,
  CurrencyCircleDollar,
  HandCoins,
} from "@phosphor-icons/react";

export function getSourceIcon(name: string) {
  const lower = name.toLowerCase();
  if (
    lower.includes("freelance") ||
    lower.includes("freela") ||
    lower.includes("computador") ||
    lower.includes("site")
  ) {
    return Laptop;
  }
  if (
    lower.includes("empresa") ||
    lower.includes("firma") ||
    lower.includes("corporação")
  ) {
    return Buildings;
  }
  if (
    lower.includes("invest") ||
    lower.includes("dividendo") ||
    lower.includes("rendimento")
  ) {
    return CurrencyCircleDollar;
  }
  if (
    lower.includes("bônus") ||
    lower.includes("comissão") ||
    lower.includes("presente")
  ) {
    return HandCoins;
  }
  return Briefcase;
}

export function SourceIcon({
  name,
  size = 20,
}: {
  name: string;
  size?: number;
}) {
  return createElement(getSourceIcon(name), { size, weight: "duotone" });
}

export type SourceItem = {
  id: string;
  name: string;
};

export function SourceSelectorModal({
  sources,
  selectedId,
  onSelect,
  onClose,
  onCreateSource,
}: {
  sources: SourceItem[];
  selectedId: string;
  onSelect: (sourceId: string) => void;
  onClose: () => void;
  onCreateSource?: (name: string) => Promise<SourceItem>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorNotice, setErrorNotice] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    return () => dialog?.close();
  }, []);

  const filtered = sources.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase().trim()),
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newSourceName.trim();
    if (!trimmed || !onCreateSource) return;
    setIsSubmitting(true);
    setErrorNotice("");
    try {
      const created = await onCreateSource(trimmed);
      onSelect(created.id);
      onClose();
    } catch {
      setErrorNotice(
        "Não foi possível criar a fonte de renda. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="ninho-selector-dialog"
      aria-labelledby="source-selector-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          ) {
            onClose();
          }
        }
      }}
    >
      <div className="ninho-selector-panel">
        <header className="ninho-selector-header">
          <div>
            <h2 id="source-selector-title">Selecionar fonte</h2>
            <p className="ninho-selector-subtitle">Para entradas.</p>
          </div>
          <button
            type="button"
            className="ninho-selector-close"
            aria-label="Fechar seleção de fonte"
            onClick={onClose}
          >
            <X size={20} weight="bold" />
          </button>
        </header>

        <div className="ninho-selector-search-box">
          <MagnifyingGlass
            size={18}
            className="ninho-search-icon"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Buscar fonte"
            placeholder="Buscar fonte"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {errorNotice ? (
          <p role="alert" className="ninho-selector-notice">
            {errorNotice}
          </p>
        ) : null}

        <div
          className="ninho-selector-list"
          role="listbox"
          aria-label="Fontes de renda"
        >
          <button
            type="button"
            role="option"
            aria-selected={!selectedId}
            className={`ninho-selector-item ${!selectedId ? "selected" : ""}`}
            onClick={() => {
              onSelect("");
              onClose();
            }}
          >
            <span className="ninho-selector-item-icon">
              <Prohibit size={20} weight="bold" />
            </span>
            <span className="ninho-selector-item-label">Sem fonte</span>
            {!selectedId ? (
              <span className="ninho-selector-check" aria-hidden="true">
                <Check size={16} weight="bold" />
              </span>
            ) : null}
          </button>

          {filtered.map((src) => {
            const isSelected = src.id === selectedId;
            return (
              <button
                type="button"
                key={src.id}
                role="option"
                aria-selected={isSelected}
                className={`ninho-selector-item ${isSelected ? "selected" : ""}`}
                onClick={() => {
                  onSelect(src.id);
                  onClose();
                }}
              >
                <span className="ninho-selector-item-icon">
                  <SourceIcon name={src.name} size={20} />
                </span>
                <span className="ninho-selector-item-label">{src.name}</span>
                {isSelected ? (
                  <span className="ninho-selector-check" aria-hidden="true">
                    <Check size={16} weight="bold" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {creating ? (
          <form className="ninho-selector-create-form" onSubmit={handleCreate}>
            <input
              type="text"
              placeholder="Nome da fonte (ex: Freelance)"
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
              maxLength={80}
              required
              autoFocus
            />
            <div className="ninho-selector-create-actions">
              <button
                type="button"
                className="ninho-selector-cancel-btn"
                onClick={() => {
                  setCreating(false);
                  setNewSourceName("");
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="ninho-selector-save-btn"
                disabled={isSubmitting || !newSourceName.trim()}
              >
                {isSubmitting ? "Criando…" : "Salvar"}
              </button>
            </div>
          </form>
        ) : onCreateSource ? (
          <footer className="ninho-selector-footer">
            <button
              type="button"
              className="ninho-selector-add-btn"
              onClick={() => {
                setCreating(true);
                setErrorNotice("");
              }}
            >
              <Plus size={18} weight="bold" />
              Criar fonte
            </button>
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
