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
  initialBalance: number | null;
  id: string;
  name: string;
  currency: string;
  balance: number;
  inflow: number;
  outflow: number;
  change: number;
  kind: string | null;
};
export type SetupAccount = {
  id: string;
  name: string;
  currency: string;
  balance: number;
  initialBalance: number | null;
};
export type Home = {
  hasFinancialActivity: boolean | null;
  setupAccounts: SetupAccount[];
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
  sourceId: string | null;
  amount: number;
  isReversal: boolean;
  reversalOf: string | null;
};
export type IncomeSourceGroup = {
  id: string | null;
  name: string;
  amount: number;
  count: number;
};
export type IncomePage = {
  sources?: IncomeSourceGroup[];
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
export type HistoryItem = {
  transactionId: string;
  accountId: string;
  accountName: string;
  description: string;
  date: string;
  kind: string;
  status: string;
  amount: number;
  currency: string;
  category: string;
  source: string | null;
  reversalOf: string | null;
};
export type HistoryOptions = {
  accounts: { id: string; name: string; currency: string }[];
  categories: {
    id: string;
    name: string;
    flow: string;
    parentId: string | null;
  }[];
  sources: { id: string; name: string }[];
};
export type HistoryDraft = HistoryFilters & {
  from: string;
  to: string;
  parentId: string;
  subcategoryId: string;
};
export function historyDraft(
  period: string,
  filters: HistoryFilters,
  catalog: HistoryOptions,
): HistoryDraft;
export function applyHistoryDraft(draft: HistoryDraft): {
  period: string;
  filters: HistoryFilters;
};
export type HistoryFilters = {
  categoryId?: string;
  incomeSourceId?: string;
  includeSubcategories?: boolean;
  search?: string;
  kind?: string;
  accountId?: string;
};
export function historyKind(item: HistoryItem): string;
export interface FinanceRepository {
  historyOptions(
    householdId: string,
    signal?: AbortSignal,
  ): Promise<HistoryOptions>;
  ledgerHistory(
    householdId: string,
    period: string,
    filters?: HistoryFilters,
    offset?: number,
    signal?: AbortSignal,
  ): Promise<{ items: HistoryItem[]; hasMore: boolean }>;
  accountOptions(
    householdId: string,
    signal?: AbortSignal,
  ): Promise<RecordOptions>;
  createAccount(
    householdId: string,
    body: { [key: string]: unknown },
    key: string,
    signal?: AbortSignal,
  ): Promise<AccountResult>;
  recordOptions(
    householdId: string,
    signal?: AbortSignal,
  ): Promise<RecordOptions>;
  postRecord(
    householdId: string,
    kind: RecordKind,
    body: { [key: string]: unknown },
    key: string,
    signal?: AbortSignal,
  ): Promise<RecordResult>;
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

export type RecordKind = "income" | "expense" | "transfer";
export type RecordFields = {
  accountId: string;
  destinationId: string;
  categoryId: string;
  sourceId: string;
  amount: string;
  date: string;
  description: string;
};
export type RecordOptions = {
  accounts: { id: string; name: string; currency: string }[];
  categories: { id: string; name: string; flow: "income" | "expense" }[];
  sources: { id: string; name: string }[];
};
export type RecordResult = { transactionId: string; replayed: boolean };
export type RecordState = {
  status: "loading" | "ready" | "saving" | "uncertain" | "success" | "error";
  kind: RecordKind;
  fields: RecordFields;
  options: RecordOptions | null;
  notice: string;
  result: RecordResult | null;
};
export function recordAmount(value: string): number;
export function prepareRecord(
  kind: RecordKind,
  fields: RecordFields,
  options: RecordOptions,
): { [key: string]: unknown };
export function createRecordStore(
  repository: FinanceRepository,
  householdId: string,
  kind: RecordKind,
  currency: string,
  options: {
    storage: {
      load: () => Promise<string | null>;
      save: (value: string) => Promise<void>;
      remove: (key: string) => Promise<void>;
    };
    randomId: () => string;
    now?: () => Date;
    timeoutMs?: number;
  },
): {
  getSnapshot: () => RecordState;
  subscribe: (listener: () => void) => () => void;
  start: () => () => void;
  retry: () => void;
  edit: (field: keyof RecordFields, value: string) => void;
  submit: () => Promise<void>;
};

export function dashboardSetupState(
  home: Home,
): "active" | "no-accounts" | "no-movements";

export type AccountFields = {
  name: string;
  kind: string;
  currency: string;
  balance: string;
  date: string;
};
export type AccountResult = {
  accountId: string;
  currency: string;
  name: string;
  replayed: boolean;
};
export type AccountState = {
  status: RecordState["status"];
  kind: "account";
  fields: AccountFields;
  options: RecordOptions | null;
  notice: string;
  result: AccountResult | null;
};
export function initialAccountAmount(value: string): number;
export function prepareAccount(
  fields: AccountFields,
  id: string,
): { [key: string]: unknown };
export function createAccountStore(
  repository: FinanceRepository,
  householdId: string,
  currency: string,
  options: {
    storage: {
      load: () => Promise<string | null>;
      save: (value: string) => Promise<void>;
      remove: (key: string) => Promise<void>;
    };
    randomId: () => string;
    now?: () => Date;
    timeoutMs?: number;
  },
): {
  getSnapshot: () => AccountState;
  subscribe: (listener: () => void) => () => void;
  start: () => () => void;
  retry: () => void;
  edit: (field: keyof AccountFields, value: string) => void;
  submit: () => Promise<void>;
};
