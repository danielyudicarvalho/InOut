"use client";

import { createElement, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  X,
  MagnifyingGlass,
  Check,
  Plus,
  CreditCard,
  Wallet,
  PiggyBank,
  TrendUp,
  Bank,
} from "@phosphor-icons/react";
import { accountKindLabel } from "@inout/finance";

export function getAccountIcon(kind: string | null | undefined, name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("carteira") || lower.includes("dinheiro") || kind === "cash") {
    return Wallet;
  }
  if (lower.includes("reserva") || lower.includes("poupança") || kind === "savings") {
    return PiggyBank;
  }
  if (lower.includes("invest") || kind === "investment") {
    return TrendUp;
  }
  if (lower.includes("banco") || lower.includes("caixa")) {
    return Bank;
  }
  return CreditCard;
}

export function AccountIcon({
  kind,
  name,
  size = 20,
}: {
  kind?: string | null;
  name: string;
  size?: number;
}) {
  return createElement(getAccountIcon(kind, name), { size, weight: "duotone" });
}

export type AccountItem = {
  id: string;
  name: string;
  currency: string;
  kind?: string | null;
};

export function AccountSelectorModal({
  accounts,
  selectedId,
  householdId,
  period,
  currency,
  onSelect,
  onClose,
}: {
  accounts: AccountItem[];
  selectedId: string;
  householdId: string;
  period: string;
  currency: string;
  onSelect: (accountId: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    return () => dialog?.close();
  }, []);

  const filtered = accounts.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase().trim()),
  );

  const createAccountHref = `/criar-conta?${new URLSearchParams({ household: householdId, period, currency })}`;

  return (
    <dialog
      ref={dialogRef}
      className="ninho-selector-dialog"
      aria-labelledby="account-selector-title"
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
          <h2 id="account-selector-title">Selecionar conta</h2>
          <button
            type="button"
            className="ninho-selector-close"
            aria-label="Fechar seleção de conta"
            onClick={onClose}
          >
            <X size={20} weight="bold" />
          </button>
        </header>

        <div className="ninho-selector-search-box">
          <MagnifyingGlass size={18} className="ninho-search-icon" aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar conta"
            placeholder="Buscar conta"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="ninho-selector-list" role="listbox" aria-label="Contas financeiras">
          {filtered.length === 0 ? (
            <p className="ninho-selector-empty">Nenhuma conta encontrada.</p>
          ) : (
            filtered.map((acc) => {
              const isSelected = acc.id === selectedId;
              const kindLabel = accountKindLabel(acc.kind ?? null);
              return (
                <button
                  type="button"
                  key={acc.id}
                  role="option"
                  aria-selected={isSelected}
                  className={`ninho-selector-item ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    onSelect(acc.id);
                    onClose();
                  }}
                >
                  <span className="ninho-selector-item-icon">
                    <AccountIcon kind={acc.kind} name={acc.name} size={20} />
                  </span>
                  <div className="ninho-selector-item-text">
                    <span className="ninho-selector-item-label">{acc.name}</span>
                    <span className="ninho-selector-item-subtitle">
                      {kindLabel} • {acc.currency}
                    </span>
                  </div>
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

        <footer className="ninho-selector-footer">
          <Link
            className="ninho-selector-add-btn"
            href={createAccountHref}
            onClick={onClose}
          >
            <Plus size={18} weight="bold" />
            Criar conta
          </Link>
        </footer>
      </div>
    </dialog>
  );
}
