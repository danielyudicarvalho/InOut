export type Household = { id: string; name: string };
export type Summary = {
  currency: string;
  balance: number;
  income: number;
  expense: number;
  result: number;
};
export type Transaction = {
  id: string;
  name: string;
  accountName: string;
  category: string;
  date: string;
  cents: number;
  currency: string;
  kind: string;
};
export type FinancialAccount = {
  id: string;
  name: string;
  currency: string;
  balance: number;
  inflow: number;
  outflow: number;
  change: number;
  kind: string | null;
};
export type Home = {
  periodStart: string;
  periodEnd: string;
  period: string;
  isReconciled: boolean;
  summaries: Summary[];
  accounts: FinancialAccount[];
  history: { period: string; summaries: Summary[] }[];
  transactions: Transaction[];
  currencies: string[];
};
export type IncomeItem = {
  id: string;
  transactionId: string;
  accountId: string;
  accountName: string;
  date: string;
  description: string | null;
  category: string | null;
  categoryId: string | null;
  source: string | null;
  amount: number;
  isReversal: boolean;
  reversalOf: string | null;
};
export type IncomePage = {
  periodStart: string;
  periodEnd: string;
  currency: string;
  total: number;
  totalCount: number;
  snapshotId: string;
  offset: number;
  isReconciled: boolean;
  items: IncomeItem[];
};
export type CategoryGroup = {
  id: string | null;
  name: string;
  amount: number;
  direct: number;
  children: CategoryGroup[];
};
export type CategorySummary = {
  total: number;
  isReconciled: boolean;
  groups: CategoryGroup[];
};
export function buildCategorySummary(
  catalog: { id: string; name: string; parentId: string | null }[],
  values: { id: string; amount: number }[],
  total: number,
  isReconciled?: boolean,
): CategorySummary;
export interface FinanceRepository {
  categorySummary(
    householdId: string,
    period: string,
    currency: string,
    signal?: AbortSignal,
  ): Promise<CategorySummary>;
  expense(
    householdId: string,
    period: string,
    currency: string,
    offset: number,
    signal?: AbortSignal,
  ): Promise<IncomePage>;
  income(
    householdId: string,
    period: string,
    currency: string,
    offset: number,
    signal?: AbortSignal,
  ): Promise<IncomePage>;
  households(signal?: AbortSignal): Promise<Household[]>;
  home(id: string, period: string, signal?: AbortSignal): Promise<Home>;
}
export class FinanceFailure extends Error {
  readonly code: string;
  constructor(code: string);
}
export function financeMessage(error: unknown): string;
export function monthOptions(now?: Date): string[];
export function periodLabel(period: string): string;
export function money(cents: number, currency: string): string;
export function createFinanceRepository(options: {
  baseUrl: string | undefined;
  getToken: () => Promise<string | null>;
  fetcher?: typeof fetch;
}): FinanceRepository;
export type HomeState = {
  status: "loading" | "empty" | "ready" | "error";
  households: Household[];
  householdId: string;
  period: string;
  periods: string[];
  data: Home | null;
  notice: string;
};
export function createFinancialHomeStore(
  repository: FinanceRepository,
  options?: {
    now?: Date;
    timeoutMs?: number;
    initialHouseholdId?: string;
    initialPeriod?: string;
  },
): {
  getSnapshot: () => HomeState;
  subscribe: (listener: () => void) => () => void;
  start: () => () => void;
  retry: () => void;
  selectHousehold: (id: string) => void;
  selectPeriod: (period: string) => void;
};

export function rangePeriod(from: string, to: string): string;
export function parsePeriod(period: string): {
  from: string;
  to: string;
  custom: boolean;
};
export function presetPeriod(
  preset: "current" | "previous" | "quarter",
  now?: Date,
): string;
export function calendarDays(month: string): (string | null)[];
export function displayDate(value: string): string;
export function inputDate(value: string): string;

export function accountKindLabel(kind: string | null): string;
export function balanceComposition(
  home: Home,
  currency: string,
): {
  total: number;
  matched: boolean;
  accounts: (FinancialAccount & { percent: number | null; width: number })[];
};

export type IncomeState = {
  status: "loading" | "ready" | "error";
  data: IncomePage | null;
  notice: string;
  loadingMore: boolean;
};
export function createIncomeDetailsStore(
  repository: FinanceRepository,
  householdId: string,
  period: string,
  currency: string,
  options?: { timeoutMs?: number; kind?: "income" | "expense" },
): {
  getSnapshot: () => IncomeState;
  subscribe: (listener: () => void) => () => void;
  start: () => () => void;
  retry: () => void;
  loadMore: () => void;
};

export function recentResultEntries(
  income: IncomeItem[],
  expense: IncomeItem[],
  filter?: "all" | "income" | "expense",
): (IncomeItem & { flow: "income" | "expense" })[];
