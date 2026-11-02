"use client";

import { createElement, useEffect, useRef, useState } from "react";
import {
  X,
  MagnifyingGlass,
  Check,
  Plus,
  Tag,
  ShoppingCart,
  ForkKnife,
  Coffee,
  GasPump,
  Bus,
  Pill,
  FirstAid,
  FilmStrip,
  Books,
} from "@phosphor-icons/react";
import { CategoryIcon, type CategoryItem } from "./category-selector-modal";

export function getSubcategoryIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("mercado") || lower.includes("feira") || lower.includes("supermercado")) {
    return ShoppingCart;
  }
  if (lower.includes("restaurante") || lower.includes("almoço") || lower.includes("jantar")) {
    return ForkKnife;
  }
  if (lower.includes("café") || lower.includes("lanche") || lower.includes("padaria")) {
    return Coffee;
  }
  if (lower.includes("combust") || lower.includes("gasolina") || lower.includes("etanol")) {
    return GasPump;
  }
  if (lower.includes("ônibus") || lower.includes("metro") || lower.includes("passagem")) {
    return Bus;
  }
  if (lower.includes("farm") || lower.includes("remédio") || lower.includes("medic")) {
    return Pill;
  }
  if (lower.includes("consulta") || lower.includes("exame") || lower.includes("dentista")) {
    return FirstAid;
  }
  if (lower.includes("cinema") || lower.includes("streaming") || lower.includes("show")) {
    return FilmStrip;
  }
  if (lower.includes("livro") || lower.includes("material") || lower.includes("escola")) {
    return Books;
  }
  return Tag;
}

export function SubcategoryIcon({
  name,
  size = 20,
}: {
  name: string;
  size?: number;
}) {
  return createElement(getSubcategoryIcon(name), { size, weight: "duotone" });
}

export function SubcategorySelectorModal({
  categories,
  parentCategory,
  selectedId,
  onSelect,
  onClose,
  onCreateSubcategory,
}: {
  categories: CategoryItem[];
  parentCategory: CategoryItem | null;
  selectedId: string;
  onSelect: (subcategoryId: string) => void;
  onClose: () => void;
  onCreateSubcategory?: (
    name: string,
    parentId: string,
    flow: "income" | "expense",
  ) => Promise<CategoryItem>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorNotice, setErrorNotice] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    return () => dialog?.close();
  }, []);

  const subcategories = categories.filter(
    (c) => parentCategory && c.parentId === parentCategory.id,
  );
  const filtered = subcategories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase().trim()),
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newSubcategoryName.trim();
    if (!trimmed || !parentCategory || !onCreateSubcategory) return;
    setIsSubmitting(true);
    setErrorNotice("");
    try {
      const created = await onCreateSubcategory(
        trimmed,
        parentCategory.id,
        parentCategory.flow,
      );
      onSelect(created.id);
      onClose();
    } catch {
      setErrorNotice("Não foi possível criar a subcategoria. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="ninho-selector-dialog"
      aria-labelledby="subcategory-selector-title"
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
            <h2 id="subcategory-selector-title">Selecionar subcategoria</h2>
            <p className="ninho-selector-subtitle">Detalhe seus gastos com mais precisão.</p>
          </div>
          <button
            type="button"
            className="ninho-selector-close"
            aria-label="Fechar seleção de subcategoria"
            onClick={onClose}
          >
            <X size={20} weight="bold" />
          </button>
        </header>

        {parentCategory ? (
          <div className="ninho-selector-parent-pill">
            <span className="ninho-parent-pill-icon">
              <CategoryIcon name={parentCategory.name} size={16} />
            </span>
            <span className="ninho-parent-pill-text">{parentCategory.name}</span>
          </div>
        ) : null}

        <div className="ninho-selector-search-box">
          <MagnifyingGlass size={18} className="ninho-search-icon" aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar subcategoria"
            placeholder="Buscar subcategoria"
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

        <div className="ninho-selector-list" role="listbox" aria-label="Subcategorias">
          {filtered.length === 0 ? (
            <div className="ninho-selector-empty">
              <p>Nenhuma subcategoria para esta categoria.</p>
              <small>Você pode criar uma subcategoria abaixo para refinar seus gastos.</small>
            </div>
          ) : (
            filtered.map((sub) => {
              const isSelected = sub.id === selectedId;
              return (
                <button
                  type="button"
                  key={sub.id}
                  role="option"
                  aria-selected={isSelected}
                  className={`ninho-selector-item ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    onSelect(sub.id);
                    onClose();
                  }}
                >
                  <span className="ninho-selector-item-icon">
                    <SubcategoryIcon name={sub.name} size={20} />
                  </span>
                  <span className="ninho-selector-item-label">{sub.name}</span>
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
              placeholder={`Nova subcategoria em ${parentCategory?.name ?? "categoria"}`}
              value={newSubcategoryName}
              onChange={(e) => setNewSubcategoryName(e.target.value)}
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
                  setNewSubcategoryName("");
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="ninho-selector-save-btn"
                disabled={isSubmitting || !newSubcategoryName.trim()}
              >
                {isSubmitting ? "Criando…" : "Salvar"}
              </button>
            </div>
          </form>
        ) : parentCategory && onCreateSubcategory ? (
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
              Criar subcategoria
            </button>
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
