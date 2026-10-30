"use client";

import Link from "next/link";
import { BrandLogo } from "../ui/brand-logo";

export interface DashboardSidebarProps {
  household?: string;
  householdName?: string;
  period?: string;
  currency?: string;
  activePage?: "inicio" | "lancamentos" | "contas" | "categorias";
  quote?: string;
}

export function DashboardSidebar({
  household = "",
  householdName = "",
  period = "",
  currency = "",
  activePage = "lancamentos",
  quote = "Grandes conquistas também nascem de pequenos registros. ♡",
}: DashboardSidebarProps) {
  const queryParams = new URLSearchParams({
    ...(household ? { household } : {}),
    ...(period ? { period } : {}),
    ...(currency ? { currency } : {}),
  });
  const queryString = queryParams.toString()
    ? `?${queryParams.toString()}`
    : "";

  return (
    <aside className="dashboard-sidebar">
      <Link className="dashboard-brand" href={`/inicio${queryString}`}>
        <BrandLogo />
      </Link>
      {householdName ? (
        <p className="record-household">⌂ {householdName}</p>
      ) : (
        <span className="sidebar-brand-subtitle">
          Suas finanças em um lugar mais leve
        </span>
      )}

      <nav aria-label="Navegação principal">
        <Link
          href={`/inicio${queryString}`}
          aria-current={activePage === "inicio" ? "page" : undefined}
        >
          Início
        </Link>
        <Link
          href={`/lancamentos${queryString}`}
          aria-current={activePage === "lancamentos" ? "page" : undefined}
        >
          Lançamentos
        </Link>
        <Link
          href={`/composicao-saldo${queryString}`}
          aria-current={activePage === "contas" ? "page" : undefined}
        >
          Contas
        </Link>
        <Link
          href={`/resumo-categorias${queryString}`}
          aria-current={activePage === "categorias" ? "page" : undefined}
        >
          Categorias
        </Link>
      </nav>

      {quote ? (
        <div className="sidebar-quote-card">
          <div className="quote-art-frame">
            <span>{quote}</span>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
