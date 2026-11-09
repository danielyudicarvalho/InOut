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
  transactionId?: string;
  categoryId?: string;
  incomeSourceId?: string;
  includeSubcategories?: boolean;
  search?: string;
  kind?: string;
  accountId?: string;
};
export function historyKind(item: Pick<HistoryItem, "kind">): string;
export type AnalysisFacts = {
  incomeCents: number;
  expenseCents: number;
  resultCents: number;
};
export type AnalysisChange = {
  kind: string;
  id: string | null;
  name: string;
  currentCents: number;
  previousCents: number;
  deltaCents: number;
  percentageChange: number | null;
};
export type AnalysisAccount = {
  id: string;
  name: string;
  incomeCents: number;
  expenseCents: number;
  transferInCents: number;
  transferOutCents: number;
  inflowCents: number;
  outflowCents: number;
  changeCents: number;
};
export type FinancialAnalysis = {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  currency: string;
  isReconciled: boolean;
  current: AnalysisFacts;
  previous: AnalysisFacts;
  changes: AnalysisChange[];
  series: (AnalysisFacts & { from: string; to: string })[];
  accounts: AnalysisAccount[];
};

export type AuxiliaryKind = "account" | "category" | "source";
export type AuxiliaryFields = {
  name: string;
  currency: string;
  accountKind: string;
  flow: string;
  parentId: string;
  date: string;
};
export function selectorSearch<T extends { name: string; detail?: string }>(
  items: T[],
  query: string,
): T[];
export function calendarMonth(month: string, delta: number): string;
export function createAuxiliaryStore(
  repository: FinanceRepository,
  household: string,
  kind: AuxiliaryKind,
  flow: string,
  parentId: string,
  currency: string,
  options: {
    storage: {
      load(): Promise<string | null>;
      save(value: string): Promise<void>;
      remove(key: string): Promise<void>;
    };
    randomId: () => string;
    now?: () => Date;
    timeoutMs?: number;
  },
): {
  getSnapshot(): {
    status: "loading" | "ready" | "saving" | "uncertain" | "success" | "error";
    fields: AuxiliaryFields;
    notice: string;
    result: { id: string } | null;
  };
  subscribe(listener: () => void): () => void;
  start(): () => void;
  retry(): void;
  edit(field: keyof AuxiliaryFields, value: string): void;
  submit(): Promise<void>;
};
export type TransactionDetail = {
  reversalId?: string | null;
  original?: TransactionDetail;
  categoryId: string | null;
  sourceId: string | null;
  rawDescription: string;
  id: string;
  kind: string;
  status: string;
  description: string;
  date: string;
  postedAt: string;
  createdBy: string;
  currency: string;
  amount: number;
  postings: {
    accountId: string;
    accountName: string;
    currency: string;
    amount: number;
  }[];
  rows: { label: string; value: string }[];
  reversalOf: string | null;
};
export function reversalEffects(
  detail: TransactionDetail,
): { accountName: string; currency: string; amount: number }[];
export function canReverse(detail: TransactionDetail | null): boolean;
export function createReversalStore(
  repository: FinanceRepository,
  household: string,
  transactionId: string,
  options: {
    storage: {
      load(): Promise<string | null>;
      save(value: string): Promise<void>;
      remove(key: string): Promise<void>;
    };
    randomId: () => string;
    now?: () => Date;
    timeoutMs?: number;
  },
): {
  getSnapshot(): {
    status: "loading" | "ready" | "saving" | "uncertain" | "success" | "error";
    fields: { date: string; description: string };
    options: TransactionDetail | null;
    notice: string;
    result: RecordResult | null;
  };
  subscribe(listener: () => void): () => void;
  start(): () => void;
  retry(): void;
  edit(field: "date" | "description", value: string): void;
  submit(): Promise<void>;
};
export type ClassificationFields = {
  categoryId: string;
  sourceId: string;
  description: string;
};
export type ClassificationOptions = RecordOptions & {
  detail: TransactionDetail;
};
export function canCorrectClassification(
  detail: TransactionDetail | null,
): boolean;
export function classificationChoices(options: ClassificationOptions): {
  categories: { id: string; name: string; disabled?: boolean }[];
  sources: { id: string; name: string; disabled?: boolean }[];
};
export function createClassificationStore(
  repository: FinanceRepository,
  household: string,
  transactionId: string,
  options: Parameters<typeof createReversalStore>[3],
): {
  getSnapshot(): {
    status:
      | "loading"
      | "ready"
      | "saving"
      | "uncertain"
      | "success"
      | "error"
      | "stale";
    fields: ClassificationFields;
    options: ClassificationOptions | null;
    notice: string;
    result: RecordResult | null;
  };
  subscribe(listener: () => void): () => void;
  start(): () => void;
  retry(): void;
  edit(field: keyof ClassificationFields, value: string): void;
  submit(): Promise<void>;
};
export interface FinanceRepository {
  analysis(
    householdId: string,
    period: string,
    currency: string,
    signal?: AbortSignal,
  ): Promise<FinancialAnalysis>;
  createCategory(
    household: string,
    body: {
      name: string;
      flow: "income" | "expense";
      parentId?: string | null;
    },
    key: string,
    signal?: AbortSignal,
  ): Promise<{ id: string; name: string; flow: string; parentId?: string }>;
  createIncomeSource(
    household: string,
    body: { name: string },
    id: string,
    signal?: AbortSignal,
  ): Promise<{ id: string; name: string }>;
  correctClassification(
    household: string,
    transactionId: string,
    body: {
      categoryId: string;
      incomeSourceId: string | null;
      description: string | null;
      expectedState?: {
        status: string;
        categoryId: string | null;
        incomeSourceId: string | null;
        description: string | null;
      };
    },
    key: string,
    signal?: AbortSignal,
  ): Promise<RecordResult>;

  transaction(
    household: string,
    transactionId: string,
    signal?: AbortSignal,
  ): Promise<TransactionDetail>;
  reverse(
    household: string,
    transactionId: string,
    body: { occurredOn: string; description: string | null },
    key: string,
    signal?: AbortSignal,
  ): Promise<RecordResult>;
  createAuxiliary(
    household: string,
    kind: AuxiliaryKind,
    body: Record<string, unknown>,
    key: string,
    signal?: AbortSignal,
  ): Promise<{ id: string }>;
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
  createCategory(
    householdId: string,
    body: {
      name: string;
      flow: "income" | "expense";
      parentId?: string | null;
    },
    key: string,
    signal?: AbortSignal,
  ): Promise<{
    id: string;
    name: string;
    flow: string;
    parentId: string | null;
  }>;
  createIncomeSource(
    householdId: string,
    body: { name: string },
    id?: string,
    signal?: AbortSignal,
  ): Promise<{ id: string; name: string }>;
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
    includeArchivedAccounts?: boolean,
  ): Promise<IncomePage>;
  households(signal?: AbortSignal): Promise<Household[]>;
  home(id: string, period: string, signal?: AbortSignal): Promise<Home>;
  budgets(
    household: string,
    from: string,
    to: string,
    signal?: AbortSignal,
  ): Promise<PlanningBudget[]>;
  budget(
    household: string,
    budgetId: string,
    signal?: AbortSignal,
  ): Promise<PlanningBudgetDetail>;
  setBudget(
    household: string,
    body: { [key: string]: unknown },
    key: string,
    signal?: AbortSignal,
  ): Promise<unknown>;
  goals(household: string, signal?: AbortSignal): Promise<PlanningGoal[]>;
  goal(
    household: string,
    goalId: string,
    signal?: AbortSignal,
  ): Promise<PlanningGoalDetail>;
  createGoal(
    household: string,
    body: { [key: string]: unknown },
    key: string,
    signal?: AbortSignal,
  ): Promise<PlanningGoal>;
  updateGoal(
    household: string,
    goalId: string,
    body: { [key: string]: unknown },
    key: string,
    signal?: AbortSignal,
  ): Promise<PlanningGoal>;
  changeGoalStatus(
    household: string,
    goalId: string,
    status: string,
    key: string,
    signal?: AbortSignal,
  ): Promise<PlanningGoal>;
  allocateGoal(
    household: string,
    goalId: string,
    body: { [key: string]: unknown },
    key: string,
    signal?: AbortSignal,
  ): Promise<unknown>;
  reverseAllocation(
    household: string,
    goalId: string,
    allocationId: string,
    body: { [key: string]: unknown },
    key: string,
    signal?: AbortSignal,
  ): Promise<unknown>;
  projects(household: string, signal?: AbortSignal): Promise<PlanningProject[]>;
  project(
    household: string,
    projectId: string,
    signal?: AbortSignal,
  ): Promise<PlanningProject>;
  createProject(
    household: string,
    body: { [key: string]: unknown },
    key: string,
    signal?: AbortSignal,
  ): Promise<PlanningProject>;
  updateProject(
    household: string,
    projectId: string,
    body: { [key: string]: unknown },
    key: string,
    signal?: AbortSignal,
  ): Promise<PlanningProject>;
  closeProject(
    household: string,
    projectId: string,
    key: string,
    signal?: AbortSignal,
  ): Promise<PlanningProject>;
  linkProjectMovement(
    household: string,
    projectId: string,
    transactionId: string,
    key: string,
    signal?: AbortSignal,
  ): Promise<PlanningProject>;
  unlinkProjectMovement(
    household: string,
    projectId: string,
    transactionId: string,
    key: string,
    signal?: AbortSignal,
  ): Promise<PlanningProject>;
  recurringPlans(
    household: string,
    signal?: AbortSignal,
  ): Promise<PlanningRecurringPlan[]>;
  recurringPreview(
    household: string,
    planId: string,
    from: string,
    signal?: AbortSignal,
  ): Promise<string[]>;
  createRecurringPlan(
    household: string,
    body: { [key: string]: unknown },
    key: string,
    signal?: AbortSignal,
  ): Promise<PlanningRecurringPlan>;
  changeRecurringStatus(
    household: string,
    planId: string,
    status: string,
    signal?: AbortSignal,
  ): Promise<PlanningRecurringPlan>;
  realizeOccurrence(
    household: string,
    planId: string,
    scheduledOn: string,
    key: string,
    signal?: AbortSignal,
  ): Promise<unknown>;
  agenda(
    household: string,
    from: string,
    to: string,
    signal?: AbortSignal,
  ): Promise<PlanningAgendaItem[]>;
  forecasts(
    household: string,
    signal?: AbortSignal,
  ): Promise<PlanningForecast[]>;
  createForecast(
    household: string,
    body: { [key: string]: unknown },
    key: string,
    signal?: AbortSignal,
  ): Promise<PlanningForecast>;
  compareForecast(
    household: string,
    forecastId: string,
    signal?: AbortSignal,
  ): Promise<PlanningForecastComparison[]>;
}
export type PlanningBudget = {
  id: string;
  categoryId: string;
  categoryName: string;
  periodStart: string;
  periodEnd: string;
  limitCents: number;
  spentCents: number | null;
  remainingCents: number | null;
  currency: string | null;
};
export type PlanningBudgetDetail = {
  budget: PlanningBudget;
  revisions: {
    id: string;
    previousLimitCents: number | null;
    limitCents: number;
    currency: string;
    createdAt: string;
  }[];
  expenses: {
    transactionId: string;
    occurredOn: string;
    description: string | null;
    accountName: string;
    amountCents: number;
  }[];
};
export type PlanningGoal = {
  id: string;
  name: string;
  targetCents: number;
  allocatedCents: number;
  targetDate: string | null;
  currency: string | null;
  status: string;
  archivedAt: string | null;
};
export type PlanningGoalDetail = {
  goal: PlanningGoal;
  allocations: {
    id: string;
    amountCents: number;
    currency: string;
    kind: string;
    reversalOf: string | null;
    occurredOn: string;
    note: string | null;
  }[];
};
export type PlanningProject = {
  id: string;
  name: string;
  currency: string;
  plannedCents: number;
  startsOn: string;
  endsOn: string | null;
  notes: string | null;
  status: string;
  lines: { id: string; name: string; flow: string; amountCents: number }[];
  movements: {
    transactionId: string;
    occurredOn: string;
    description: string | null;
  }[];
  comparison: {
    plannedIncomeCents: number;
    plannedExpenseCents: number;
    actualIncomeCents: number;
    actualExpenseCents: number;
  };
};
export type PlanningRecurringPlan = {
  id: string;
  name: string;
  flow: string;
  accountId: string;
  categoryId: string;
  amountCents: number;
  currency: string;
  dayOfMonth: number;
  startsOn: string;
  endsOn: string | null;
  status: string;
};
export type PlanningAgendaItem = {
  planId: string;
  planName: string;
  scheduledOn: string;
  flow: string;
  amountCents: number;
  currency: string;
  state: string;
  transactionId: string | null;
};
export type PlanningForecast = {
  id: string;
  accountId: string;
  currency: string;
  asOf: string;
  months: number;
  openingBalanceCents: number;
  points: {
    month: string;
    expectedIncomeCents: number;
    expectedExpenseCents: number;
    projectedBalanceCents: number;
    contributions: {
      planId: string;
      scheduledOn: string;
      flow: string;
      amountCents: number;
      currency: string;
    }[];
  }[];
  assumptions: {
    planId: string;
    name: string;
    amountCents: number;
    currency: string;
    dayOfMonth: number;
    status: string;
  }[];
};
export type PlanningForecastComparison = {
  month: string;
  expectedIncomeCents: number;
  expectedExpenseCents: number;
  projectedBalanceCents: number;
  actualIncomeCents: number;
  actualExpenseCents: number;
};
export class FinanceFailure extends Error {
  readonly code: string;
  constructor(code: string);
}
export function financeMessage(error: unknown): string;
export function monthOptions(now?: Date): string[];
export function periodLabel(period: string): string;
export function parseMoneyInput(value: string): number;
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
  subcategoryId?: string;
  sourceId: string;
  amount: string;
  date: string;
  description: string;
};
export type RecordReview = {
  amount: number;
  currency: string;
  rows: { field: keyof RecordFields | null; label: string; value: string }[];
};
export function recordReview(
  kind: RecordKind,
  fields: RecordFields,
  options: RecordOptions,
): RecordReview;
export type RecordOptions = {
  accounts: {
    id: string;
    name: string;
    currency: string;
    kind?: string | null;
  }[];
  categories: {
    id: string;
    name: string;
    flow: "income" | "expense";
    parentId?: string | null;
  }[];
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
    preferredAccountId?: string;
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

export function createTransactionDetailStore(
  repository: FinanceRepository,
  household: string,
  transactionId: string,
  options?: { timeoutMs?: number },
): {
  getSnapshot(): {
    status: "loading" | "ready" | "error";
    detail: TransactionDetail | null;
    notice: string;
    refreshed: boolean;
  };
  subscribe(listener: () => void): () => void;
  start(): () => void;
  reload(): Promise<boolean>;
};

export function reversalReconciliation(
  detail: TransactionDetail,
  original: TransactionDetail,
): {
  accountId: string;
  accountName: string;
  currency: string;
  original: number;
  compensation: number;
  net: number;
}[];

export type CorrectionChainStep = {
  step: number;
  kind: "original" | "reversal" | "substitute";
  title: string;
  detail: TransactionDetail;
  reason?: string;
  note?: string;
  statusBadge: "Estornado" | "Registrado";
  isReversal?: boolean;
};

export type CorrectionChain = {
  transactionId: string;
  householdId: string;
  steps: CorrectionChainStep[];
  netAmount: number;
  currency: string;
  netLabel: string;
  hasSubstitute: boolean;
  hasReversal: boolean;
};

export function getCorrectionChain(
  repository: FinanceRepository,
  household: string,
  transactionId: string,
  signal?: AbortSignal,
): Promise<CorrectionChain>;

export function createCorrectionChainStore(
  repository: FinanceRepository,
  household: string,
  transactionId: string,
): {
  getSnapshot(): {
    status: "loading" | "ready" | "error";
    chain: CorrectionChain | null;
    notice: string;
  };
  subscribe(listener: () => void): () => void;
  start(): void;
  retry(): void;
};

export type DuplicateRecord = {
  id: string;
  displayId: string;
  description: string;
  amount: number;
  currency: string;
  kind: string;
  date: string;
  status: string;
  accountName: string;
  categoryName: string | null;
  subcategoryName: string | null;
  createdBy: string;
  postedAt: string;
  raw: TransactionDetail;
};

export type DuplicateComparison = {
  householdId: string;
  first: DuplicateRecord;
  second: DuplicateRecord;
  suggestedToReverseId: string;
};

export function shortTransactionId(id: string): string;
export function formatDuplicateRecord(
  detail: TransactionDetail,
): DuplicateRecord;
export function getDuplicateComparison(
  repository: FinanceRepository,
  household: string,
  firstId: string,
  secondId?: string,
  signal?: AbortSignal,
): Promise<DuplicateComparison>;

export function createDuplicateResolutionStore(
  repository: FinanceRepository,
  household: string,
  firstId: string,
  secondId?: string,
): {
  getSnapshot(): {
    status: "loading" | "ready" | "error";
    comparison: DuplicateComparison | null;
    selectedId: string;
    notice: string;
  };
  subscribe(listener: () => void): () => void;
  start(): void;
  retry(): void;
  select(id: string): void;
};

export type FinanceTelemetrySink = (
  event: "financial_command_failed",
  properties: {
    command: string;
    error_code: string;
    is_retryable: boolean;
    outcome_known: boolean;
  },
) => void;
export function setFinanceTelemetry(sink: FinanceTelemetrySink | null): void;
export type RecordFormEvent =
  "record_form_started" | "record_form_submitted" | "record_form_abandoned";
export function createRecordFormTracker(options: {
  kind: RecordKind;
  emit: (event: RecordFormEvent, properties: Record<string, unknown>) => void;
  now?: () => number;
}): {
  start(): void;
  edit(field: string): void;
  submit(): void;
  close(): void;
};
