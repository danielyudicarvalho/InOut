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
export interface FinanceRepository {
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
