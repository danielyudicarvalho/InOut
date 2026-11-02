"use client";

import { createElement, useEffect, useRef, useState } from "react";
import {
  X,
  MagnifyingGlass,
  Check,
  Plus,
  ForkKnife,
  House,
  Car,
  Heart,
  GameController,
  GraduationCap,
  Sparkle,
  Bag,
  Coins,
  Receipt,
  Airplane,
} from "@phosphor-icons/react";

export function getCategoryIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("aliment") || lower.includes("comida") || lower.includes("restaurante")) {
    return ForkKnife;
  }
  if (lower.includes("morad") || lower.includes("casa") || lower.includes("aluguel")) {
    return House;
  }
  if (lower.includes("transp") || lower.includes("carro") || lower.includes("uber") || lower.includes("combust")) {
    return Car;
  }
  if (lower.includes("saúd") || lower.includes("saud") || lower.includes("farm") || lower.includes("médic")) {
    return Heart;
  }
  if (lower.includes("lazer") || lower.includes("jog") || lower.includes("divers")) {
    return GameController;
  }
  if (lower.includes("educa") || lower.includes("estud") || lower.includes("curso") || lower.includes("livro")) {
    return GraduationCap;
  }
  if (lower.includes("viagem") || lower.includes("voo") || lower.includes("ferias")) {
    return Airplane;
  }
  if (lower.includes("compra") || lower.includes("mercado") || lower.includes("loja")) {
    return Bag;
  }
  if (lower.includes("conta") || lower.includes("boleto") || lower.includes("imposto")) {
    return Receipt;
  }
  if (lower.includes("salário") || lower.includes("renda") || lower.includes("invest")) {
    return Coins;
  }
  return Sparkle;
}

export function CategoryIcon({
  name,
  size = 20,
}: {
  name: string;
  size?: number;
}) {
  return createElement(getCategoryIcon(name), { size, weight: "duotone" });
}

export type CategoryItem = {
  id: string;
  name: string;
  flow: "income" | "expense";
  parentId?: string | null;
};

export function CategorySelectorModal({
  categories,
  selectedId,
  flow,
  onSelect,
  onClose,
  onCreateCategory,
}: {
  categories: CategoryItem[];
  selectedId: string;
  flow: "income" | "expense";
  onSelect: (categoryId: string) => void;
  onClose: () => void;
  onCreateCategory?: (name: string, flow: "income" | "expense") => Promise<CategoryItem>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorNotice, setErrorNotice] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    return () => dialog?.close();
  }, []);

  const rootCategories = categories.filter((c) => !c.parentId && c.flow === flow);
  const filtered = rootCategories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase().trim()),
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed || !onCreateCategory) return;
    setIsSubmitting(true);
    setErrorNotice("");
    try {
      const created = await onCreateCategory(trimmed, flow);
      onSelect(created.id);
      onClose();
    } catch {
      setErrorNotice("Não foi possível criar a categoria. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="ninho-selector-dialog"
      aria-labelledby="category-selector-title"
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
          <h2 id="category-selector-title">Selecionar categoria</h2>
          <button
            type="button"
            className="ninho-selector-close"
            aria-label="Fechar seleção de categoria"
            onClick={onClose}
          >
            <X size={20} weight="bold" />
          </button>
        </header>

        <div className="ninho-selector-search-box">
          <MagnifyingGlass size={18} className="ninho-search-icon" aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar categoria"
            placeholder="Buscar categoria"
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

        <div className="ninho-selector-list" role="listbox" aria-label="Categorias">
          {filtered.length === 0 ? (
            <p className="ninho-selector-empty">Nenhuma categoria encontrada.</p>
          ) : (
            filtered.map((cat) => {
              const isSelected = cat.id === selectedId;
              return (
                <button
                  type="button"
                  key={cat.id}
                  role="option"
                  aria-selected={isSelected}
                  className={`ninho-selector-item ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    onSelect(cat.id);
                    onClose();
                  }}
                >
                  <span className="ninho-selector-item-icon">
                    <CategoryIcon name={cat.name} size={20} />
                  </span>
                  <span className="ninho-selector-item-label">{cat.name}</span>
                  {isSelected ? (
                    <span className="ninho-selector-check" aria-hidden="true">
                      <Check size={16} weight="bold" />
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        {creating ? (
          <form className="ninho-selector-create-form" onSubmit={handleCreate}>
            <input
              type="text"
              placeholder="Nome da nova categoria"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
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
                  setNewCategoryName("");
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="ninho-selector-save-btn"
                disabled={isSubmitting || !newCategoryName.trim()}
              >
                {isSubmitting ? "Criando…" : "Salvar"}
              </button>
            </div>
          </form>
        ) : onCreateCategory ? (
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
              Criar categoria
            </button>
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
