using InOut.Domain.Financial;

namespace InOut.Application.Financial;

public sealed record LedgerWriteResult(Guid TransactionId, bool Replayed);

public sealed record AccountBalance(Guid AccountId, string Currency, long BalanceCents);

public sealed record AccountSummary(
    Guid Id,
    string Name,
    AccountKind Kind,
    string Currency,
    long BalanceCents,
    DateTimeOffset? ArchivedAt);

public sealed record AccountCreationResult(AccountSummary Account, bool Replayed);

public sealed record IncomeSourceSummary(Guid Id, string Name, DateTimeOffset? ArchivedAt);

public sealed record CategorySummary(
    Guid Id,
    string Name,
    FinancialFlow Flow,
    Guid? ParentId,
    DateTimeOffset? ArchivedAt);

public sealed record LedgerHistoryFilter(
    DateOnly? From = null,
    DateOnly? To = null,
    Guid? AccountId = null,
    Guid? CategoryId = null,
    FinancialTransactionKind? Kind = null);

public sealed record LedgerHistoryItem(
    Guid TransactionId,
    FinancialTransactionKind Kind,
    FinancialTransactionStatus Status,
    string? Description,
    Guid? ReversalOf,
    DateOnly OccurredOn,
    DateTimeOffset PostedAt,
    Guid CreatedBy,
    Guid AccountId,
    string AccountName,
    Guid? CategoryId,
    string? CategoryName,
    EntryDirection Direction,
    long AmountCents,
    string Currency,
    Guid? IncomeSourceId = null,
    string? IncomeSourceName = null);

public sealed record LedgerReconciliation(
    bool IsConsistent,
    long PostedTransactionCount,
    long EntryTransactionCount,
    IReadOnlyList<AccountBalance> Balances);

public sealed record DashboardAccountBalance(
    Guid AccountId, string AccountName, string Currency, long BalanceCents);

public sealed record DashboardCurrencySummary(
    string Currency, long ConsolidatedBalanceCents, long IncomeCents,
    long ExpenseCents, long ResultCents);

public sealed record DashboardCategoryExpense(
    Guid CategoryId, string CategoryName, Guid? ParentId, string Currency, long AmountCents);

public sealed record DashboardBudgetProgress(
    Guid BudgetId, Guid CategoryId, string CategoryName, long LimitCents, long SpentCents);

public sealed record DashboardGoalProgress(
    Guid GoalId, string Name, long TargetCents, long AllocatedCents, DateOnly? TargetDate);

public sealed record FinancialDashboard(
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    bool IsReconciled,
    IReadOnlyList<DashboardCurrencySummary> Summaries,
    IReadOnlyList<DashboardAccountBalance> Accounts,
    IReadOnlyList<DashboardCategoryExpense> CategoryExpenses,
    IReadOnlyList<DashboardBudgetProgress> Budgets,
    IReadOnlyList<DashboardGoalProgress> Goals);
