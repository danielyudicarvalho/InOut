"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  CalendarBlank,
  Tag,
  Wallet,
  Briefcase,
  Sparkle,
  TrendUp,
  MagnifyingGlass,
  Check,
  Plus,
  CaretLeft,
  CaretRight,
  Prohibit,
  ShoppingCart,
  ForkKnife,
  Laptop,
} from "@phosphor-icons/react";
import {
  CategorySelectorModal,
  CategoryIcon,
  type CategoryItem,
} from "../../components/selectors/category-selector-modal";
import {
  SubcategorySelectorModal,
  SubcategoryIcon,
} from "../../components/selectors/subcategory-selector-modal";
import {
  AccountSelectorModal,
  AccountIcon,
} from "../../components/selectors/account-selector-modal";
import {
  SourceSelectorModal,
  SourceIcon,
} from "../../components/selectors/source-selector-modal";
import { DateSelectorModal } from "../../components/selectors/date-selector-modal";
import { SelectorTrigger } from "../../components/selectors/selector-trigger";

const mockCategories: CategoryItem[] = [
  { id: "cat-1", name: "Alimentação", flow: "expense", parentId: null },
  { id: "cat-2", name: "Moradia", flow: "expense", parentId: null },
  { id: "cat-3", name: "Transporte", flow: "expense", parentId: null },
  { id: "cat-4", name: "Saúde", flow: "expense", parentId: null },
  { id: "sub-1", name: "Mercado", flow: "expense", parentId: "cat-1" },
  { id: "sub-2", name: "Restaurante", flow: "expense", parentId: "cat-1" },
  { id: "sub-3", name: "Aluguel", flow: "expense", parentId: "cat-2" },
  { id: "sub-4", name: "Condomínio", flow: "expense", parentId: "cat-2" },
  { id: "cat-5", name: "Salário", flow: "income", parentId: null },
  { id: "cat-6", name: "Investimentos", flow: "income", parentId: null },
];

const mockAccounts = [
  { id: "acc-1", name: "Conta principal", currency: "BRL", kind: "checking" },
  { id: "acc-2", name: "Carteira", currency: "BRL", kind: "cash" },
  { id: "acc-3", name: "Reserva da família", currency: "BRL", kind: "savings" },
];

const mockSources = [
  { id: "src-1", name: "Empresa" },
  { id: "src-2", name: "Freelance" },
  { id: "src-3", name: "Consultoria" },
];

export default function PreviewSeletoresPage() {
  const [categories, setCategories] = useState<CategoryItem[]>(mockCategories);
  const [sources, setSources] = useState(mockSources);

  const [categoryId, setCategoryId] = useState("cat-1");
  const [subcategoryId, setSubcategoryId] = useState("sub-1");
  const [accountId, setAccountId] = useState("acc-1");
  const [sourceId, setSourceId] = useState("src-1");
  const [date, setDate] = useState("2026-10-30");
  const [amount, setAmount] = useState("0,00");
  const [description, setDescription] = useState("");

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [subcategoryModalOpen, setSubcategoryModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [dateModalOpen, setDateModalOpen] = useState(false);

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;
  const selectedSubcategory = categories.find((c) => c.id === subcategoryId);
  const selectedAccount = mockAccounts.find((a) => a.id === accountId);
  const selectedSource = sources.find((s) => s.id === sourceId);

  return (
    <div className="ninho-record-screen">
      {/* Top Banner Header */}
      <header className="ninho-record-page-header">
        <div>
          <h1 className="ninho-record-main-title">Seletores auxiliares</h1>
          <p className="ninho-record-main-subtitle">
            Escolhas simples para registrar com tranquilidade.
          </p>
        </div>
        <div className="ninho-record-household-badge">
          <span>Nosso Ninho • Residência</span>
        </div>
      </header>

      {/* Main 3-Column Desktop Stage: Pipo Left + Center Form + Pipo Right */}
      <div className="ninho-record-stage">
        {/* Left Column: Pipo organizing index cards */}
        <aside className="ninho-stage-art ninho-stage-art-left">
          <div className="ninho-art-bubble">
            <p>Pipo sempre ajuda a organizar as suas escolhas. ♡</p>
          </div>
          <Image
            src="/images/pipo-selectors-cards.webp"
            alt="Pipo organizando fichas de categoria, subcategoria, conta e data"
            width={380}
            height={285}
            className="ninho-pipo-mascot"
            priority
          />
        </aside>

        {/* Center Column: The Interactive Form Card */}
        <section className="ninho-form-card">
          <div className="ninho-form-card-top">
            <div className="ninho-form-header-badge">
              <span className="ninho-kind-icon-circle expense">
                <ArrowDown size={24} weight="bold" />
              </span>
              <div>
                <h2>Nova saída</h2>
                <p>Registre um gasto para manter tudo em dia.</p>
              </div>
            </div>
          </div>

          <form
            className="ninho-record-form"
            onSubmit={(e) => e.preventDefault()}
          >
            <fieldset className="ninho-form-fields">
              {/* Row 1: Valor & Data */}
              <div className="ninho-form-grid-2">
                <div className="ninho-field-group">
                  <label
                    htmlFor="preview-valor-input"
                    className="ninho-field-label"
                  >
                    Valor
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="R$ 0,00"
                    className="ninho-text-input ninho-amount-input"
                    id="preview-valor-input"
                  />
                  <span className="ninho-field-hint">Ex: 1250,50</span>
                </div>

                <div className="ninho-field-group">
                  <label
                    htmlFor="preview-date-input"
                    className="ninho-field-label"
                  >
                    Data
                  </label>
                  <div className="ninho-date-picker-wrap">
                    <input
                      id="preview-date-input"
                      type="text"
                      readOnly
                      value="30/10/2026"
                      onClick={() => setDateModalOpen(true)}
                      className="ninho-text-input ninho-date-trigger-input"
                    />
                    <button
                      type="button"
                      aria-label="Selecionar data no calendário"
                      className="ninho-date-calendar-btn"
                      onClick={() => setDateModalOpen(true)}
                    >
                      <CalendarBlank size={20} weight="bold" />
                    </button>
                  </div>
                  <span className="ninho-field-hint">
                    Clique para abrir o calendário
                  </span>
                </div>
              </div>

              {/* Row 2: Categoria & Subcategoria */}
              <div className="ninho-form-grid-2">
                <SelectorTrigger
                  id="preview-category-trigger"
                  label="Categoria"
                  valueText={selectedCategory?.name}
                  placeholder="Selecionar categoria"
                  icon={
                    selectedCategory ? (
                      <CategoryIcon name={selectedCategory.name} size={18} />
                    ) : (
                      <Sparkle size={18} weight="duotone" />
                    )
                  }
                  onClick={() => setCategoryModalOpen(true)}
                />

                <SelectorTrigger
                  id="preview-subcategory-trigger"
                  label="Subcategoria"
                  valueText={selectedSubcategory?.name}
                  placeholder="Selecionar subcategoria"
                  icon={
                    selectedSubcategory ? (
                      <SubcategoryIcon
                        name={selectedSubcategory.name}
                        size={18}
                      />
                    ) : (
                      <Tag size={18} weight="duotone" />
                    )
                  }
                  onClick={() => setSubcategoryModalOpen(true)}
                />
              </div>

              {/* Row 3: Conta & Fonte de renda */}
              <div className="ninho-form-grid-2">
                <SelectorTrigger
                  id="preview-account-trigger"
                  label="Conta"
                  valueText={selectedAccount?.name}
                  placeholder="Selecionar conta"
                  icon={
                    selectedAccount ? (
                      <AccountIcon
                        name={selectedAccount.name}
                        kind={selectedAccount.kind}
                        size={18}
                      />
                    ) : (
                      <Wallet size={18} weight="duotone" />
                    )
                  }
                  onClick={() => setAccountModalOpen(true)}
                />

                <SelectorTrigger
                  id="preview-source-trigger"
                  label="Fonte de renda"
                  valueText={selectedSource?.name}
                  placeholder="Selecionar fonte"
                  icon={
                    selectedSource ? (
                      <SourceIcon name={selectedSource.name} size={18} />
                    ) : (
                      <Briefcase size={18} weight="duotone" />
                    )
                  }
                  onClick={() => setSourceModalOpen(true)}
                />
              </div>

              {/* Row 4: Descrição */}
              <div className="ninho-field-group">
                <label
                  htmlFor="preview-description-input"
                  className="ninho-field-label"
                >
                  Descrição
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex.: Supermercado, farmácia…"
                  className="ninho-text-input"
                  id="preview-description-input"
                />
              </div>

              {/* Action Buttons */}
              <div className="ninho-form-actions">
                <button
                  type="button"
                  className="ninho-secondary-btn"
                  id="preview-cancel-btn"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="ninho-primary-btn"
                  id="preview-submit-btn"
                >
                  Salvar saída
                </button>
              </div>
            </fieldset>
          </form>
        </section>

        {/* Right Column: Pipo peaceful future */}
        <aside className="ninho-stage-art ninho-stage-art-right">
          <div className="ninho-art-bubble-right">
            <span className="ninho-tiny-badge">
              Pequenas escolhas, grandes conquistas.
            </span>
            <p>Organizar hoje, um Ninho mais tranquilo amanhã.</p>
          </div>
          <Image
            src="/images/pipo-peaceful-future.webp"
            alt="Pipo segurando um cartão com folha ao lado de caixas de organização"
            width={380}
            height={285}
            className="ninho-pipo-mascot"
            priority
          />
        </aside>
      </div>

      {/* Auxiliary Selectors Showcase Gallery (Matching Reference Lower Section) */}
      <section className="ninho-showcase-section" style={{ marginTop: "48px" }}>
        <div className="ninho-showcase-grid">
          {/* 1. Subcategory Selector Card */}
          <div className="ninho-showcase-column">
            <div className="ninho-showcase-header">
              <span className="ninho-showcase-tag-icon">
                <Tag size={20} weight="fill" />
              </span>
              <div>
                <h3>Selecionador de subcategoria</h3>
                <p>Detalhe seus gastos com mais precisão.</p>
              </div>
            </div>
            <div className="ninho-selector-panel ninho-showcase-panel">
              <div className="ninho-selector-header">
                <h2>Selecionar subcategoria</h2>
                <span className="ninho-selector-close">✕</span>
              </div>
              <div className="ninho-selector-parent-pill">
                <span className="ninho-parent-pill-icon">
                  <ForkKnife size={14} weight="duotone" />
                </span>
                <span>Alimentação</span>
              </div>
              <div className="ninho-selector-search-box">
                <MagnifyingGlass size={18} className="ninho-search-icon" />
                <input type="text" readOnly placeholder="Buscar subcategoria" />
              </div>
              <div className="ninho-selector-list">
                <div className="ninho-selector-item selected">
                  <div className="ninho-selector-item-icon">
                    <ShoppingCart size={18} weight="duotone" />
                  </div>
                  <div className="ninho-selector-item-text">
                    <span className="ninho-selector-item-label">Mercado</span>
                  </div>
                  <span className="ninho-selector-check">
                    <Check size={14} weight="bold" />
                  </span>
                </div>
                <div className="ninho-selector-item">
                  <div className="ninho-selector-item-icon">
                    <ForkKnife size={18} weight="duotone" />
                  </div>
                  <div className="ninho-selector-item-text">
                    <span className="ninho-selector-item-label">
                      Restaurante
                    </span>
                  </div>
                </div>
              </div>
              <button type="button" className="ninho-selector-create-btn">
                <Plus size={16} weight="bold" /> Criar subcategoria
              </button>
            </div>
          </div>

          {/* 2. Source Selector Card */}
          <div className="ninho-showcase-column">
            <div className="ninho-showcase-header">
              <span className="ninho-showcase-source-icon">
                <TrendUp size={20} weight="bold" />
              </span>
              <div>
                <h3>Selecionador de fonte de renda</h3>
                <p>Para entradas.</p>
              </div>
            </div>
            <div className="ninho-selector-panel ninho-showcase-panel">
              <div className="ninho-selector-header">
                <h2>Selecionar fonte</h2>
                <span className="ninho-selector-close">✕</span>
              </div>
              <div className="ninho-selector-search-box">
                <MagnifyingGlass size={18} className="ninho-search-icon" />
                <input type="text" readOnly placeholder="Buscar fonte" />
              </div>
              <div className="ninho-selector-list">
                <div className="ninho-selector-item">
                  <div className="ninho-selector-item-icon">
                    <Prohibit size={18} />
                  </div>
                  <div className="ninho-selector-item-text">
                    <span className="ninho-selector-item-label">Sem fonte</span>
                  </div>
                </div>
                <div className="ninho-selector-item selected">
                  <div className="ninho-selector-item-icon">
                    <Briefcase size={18} weight="duotone" />
                  </div>
                  <div className="ninho-selector-item-text">
                    <span className="ninho-selector-item-label">Empresa</span>
                  </div>
                  <span className="ninho-selector-check">
                    <Check size={14} weight="bold" />
                  </span>
                </div>
                <div className="ninho-selector-item">
                  <div className="ninho-selector-item-icon">
                    <Laptop size={18} weight="duotone" />
                  </div>
                  <div className="ninho-selector-item-text">
                    <span className="ninho-selector-item-label">Freelance</span>
                  </div>
                </div>
              </div>
              <button type="button" className="ninho-selector-create-btn">
                <Plus size={16} weight="bold" /> Criar fonte
              </button>
            </div>
          </div>

          {/* 3. Date Selector Card */}
          <div className="ninho-showcase-column">
            <div className="ninho-showcase-header">
              <span className="ninho-showcase-calendar-icon">
                <CalendarBlank size={20} weight="bold" />
              </span>
              <div>
                <h3>Selecionador de data</h3>
                <p>Escolha a data que melhor se encaixa.</p>
              </div>
            </div>
            <div className="ninho-selector-panel ninho-calendar-panel ninho-showcase-panel">
              <div className="ninho-selector-header">
                <h2>Selecionar data</h2>
                <span className="ninho-selector-close">✕</span>
              </div>
              <div className="ninho-calendar-nav">
                <button type="button" className="ninho-calendar-nav-btn">
                  <CaretLeft size={18} />
                </button>
                <span className="ninho-calendar-title">Outubro de 2026</span>
                <button type="button" className="ninho-calendar-nav-btn">
                  <CaretRight size={18} />
                </button>
              </div>
              <div className="ninho-calendar-grid">
                <div className="ninho-calendar-weekdays">
                  <span className="ninho-calendar-weekday">Seg</span>
                  <span className="ninho-calendar-weekday">Ter</span>
                  <span className="ninho-calendar-weekday">Qua</span>
                  <span className="ninho-calendar-weekday">Qui</span>
                  <span className="ninho-calendar-weekday">Sex</span>
                  <span className="ninho-calendar-weekday">Sáb</span>
                  <span className="ninho-calendar-weekday">Dom</span>
                </div>
                <div className="ninho-calendar-days">
                  <span className="ninho-calendar-blank" />
                  <span className="ninho-calendar-blank" />
                  <span className="ninho-calendar-blank" />
                  <span className="ninho-calendar-day">1</span>
                  <span className="ninho-calendar-day">2</span>
                  <span className="ninho-calendar-day">3</span>
                  <span className="ninho-calendar-day">4</span>
                  <span className="ninho-calendar-day">5</span>
                  <span className="ninho-calendar-day">6</span>
                  <span className="ninho-calendar-day">7</span>
                  <span className="ninho-calendar-day">8</span>
                  <span className="ninho-calendar-day">9</span>
                  <span className="ninho-calendar-day">10</span>
                  <span className="ninho-calendar-day">11</span>
                  <span className="ninho-calendar-day">12</span>
                  <span className="ninho-calendar-day">13</span>
                  <span className="ninho-calendar-day">14</span>
                  <span className="ninho-calendar-day">15</span>
                  <span className="ninho-calendar-day">16</span>
                  <span className="ninho-calendar-day">17</span>
                  <span className="ninho-calendar-day">18</span>
                  <span className="ninho-calendar-day">19</span>
                  <span className="ninho-calendar-day">20</span>
                  <span className="ninho-calendar-day">21</span>
                  <span className="ninho-calendar-day">22</span>
                  <span className="ninho-calendar-day">23</span>
                  <span className="ninho-calendar-day">24</span>
                  <span className="ninho-calendar-day">25</span>
                  <span className="ninho-calendar-day">26</span>
                  <span className="ninho-calendar-day">27</span>
                  <span className="ninho-calendar-day">28</span>
                  <span className="ninho-calendar-day">29</span>
                  <span className="ninho-calendar-day selected">30</span>
                  <span className="ninho-calendar-day">31</span>
                </div>
              </div>
              <div className="ninho-calendar-footer">
                <button type="button" className="ninho-selector-cancel-btn">
                  Hoje
                </button>
                <button type="button" className="ninho-selector-confirm-btn">
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Modal Dialogs (open on trigger click) */}
      {categoryModalOpen ? (
        <CategorySelectorModal
          categories={categories}
          selectedId={categoryId}
          flow="expense"
          onSelect={(id) => {
            setCategoryId(id);
            setSubcategoryId("");
          }}
          onClose={() => setCategoryModalOpen(false)}
          onCreateCategory={async (name, flow) => {
            const newCat: CategoryItem = {
              id: `cat-${Date.now()}`,
              name,
              flow,
              parentId: null,
            };
            setCategories((prev) => [...prev, newCat]);
            return newCat;
          }}
        />
      ) : null}

      {subcategoryModalOpen ? (
        <SubcategorySelectorModal
          categories={categories}
          parentCategory={selectedCategory}
          selectedId={subcategoryId}
          onSelect={(id) => {
            setSubcategoryId(id);
          }}
          onClose={() => setSubcategoryModalOpen(false)}
          onCreateSubcategory={async (name, parentId, flow) => {
            const newSub: CategoryItem = {
              id: `sub-${Date.now()}`,
              name,
              flow,
              parentId,
            };
            setCategories((prev) => [...prev, newSub]);
            return newSub;
          }}
        />
      ) : null}

      {accountModalOpen ? (
        <AccountSelectorModal
          accounts={mockAccounts}
          selectedId={accountId}
          householdId="demo-household"
          period="2026-10"
          currency="BRL"
          onSelect={(id) => {
            setAccountId(id);
          }}
          onClose={() => setAccountModalOpen(false)}
        />
      ) : null}

      {sourceModalOpen ? (
        <SourceSelectorModal
          sources={sources}
          selectedId={sourceId}
          onSelect={(id) => {
            setSourceId(id);
          }}
          onClose={() => setSourceModalOpen(false)}
          onCreateSource={async (name) => {
            const newSrc = {
              id: `src-${Date.now()}`,
              name,
            };
            setSources((prev) => [...prev, newSrc]);
            return newSrc;
          }}
        />
      ) : null}

      {dateModalOpen ? (
        <DateSelectorModal
          value={date}
          onSelect={(d) => {
            setDate(d);
          }}
          onClose={() => setDateModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
