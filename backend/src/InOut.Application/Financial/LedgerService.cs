using InOut.Application.Idempotency;
using InOut.Domain.Financial;

namespace InOut.Application.Financial;

public sealed class LedgerService(ILedgerStore store)
{
    public Task<AccountCreationResult> CreateAccountAsync(
        Guid actorUserId,
        CreateAccountCommand command,
        CancellationToken cancellationToken)
    {
        var opening = Account.Open(
            command.Id,
            command.HouseholdId,
            command.Name,
            command.Kind,
            command.Currency,
            command.InitialBalanceCents,
            command.OpeningDate,
            actorUserId);
        var idempotency = IdempotencyRequest.Create(
            command.HouseholdId,
            actorUserId,
            IdempotencyOperation.CreateAccount,
            command.IdempotencyKey,
            opening.Account.Id,
            opening.Account.Name,
            opening.Account.Kind,
            opening.Account.Currency,
            command.InitialBalanceCents,
            command.OpeningDate);
        return store.CreateAccountAsync(opening, idempotency, cancellationToken);
    }

    public Task<IReadOnlyList<AccountSummary>> GetAccountsAsync(
        Guid householdId,
        bool includeArchived,
        CancellationToken cancellationToken) =>
        store.GetAccountsAsync(householdId, includeArchived, cancellationToken);

    public Task ArchiveAccountAsync(
        Guid householdId,
        Guid accountId,
        Guid actorUserId,
        CancellationToken cancellationToken) =>
        store.ArchiveAccountAsync(householdId, accountId, actorUserId, cancellationToken);

    public Task<IReadOnlyList<CategorySummary>> GetCategoriesAsync(
        Guid householdId,
        FinancialFlow? flow,
        bool includeArchived,
        CancellationToken cancellationToken) =>
        store.GetCategoriesAsync(householdId, flow, includeArchived, cancellationToken);

    public Task<IReadOnlyList<CategorySummary>> GetCategoriesAsync(
        Guid householdId, FinancialFlow? flow, CancellationToken cancellationToken) =>
        GetCategoriesAsync(householdId, flow, false, cancellationToken);

    public Task<CategorySummary> CreateCategoryAsync(
        Guid householdId, Guid actorUserId, Guid id, string? name,
        FinancialFlow flow, Guid? parentId, Guid idempotencyKey,
        CancellationToken cancellationToken)
    {
        var category = Category.Create(id, householdId, name, flow, parentId);
        var idempotency = IdempotencyRequest.Create(
            householdId,
            actorUserId,
            IdempotencyOperation.CreateCategory,
            idempotencyKey,
            category.Id,
            category.Name,
            category.Flow,
            category.ParentId);
        return store.CreateCategoryAsync(
            householdId, actorUserId, category.Id, category.Name, category.Flow,
            category.ParentId,
            idempotency, cancellationToken);
    }

    public Task ArchiveCategoryAsync(
        Guid householdId, Guid categoryId, Guid actorUserId, CancellationToken cancellationToken) =>
        store.ArchiveCategoryAsync(householdId, categoryId, actorUserId, cancellationToken);

    public Task<IReadOnlyList<LedgerHistoryItem>> GetHistoryAsync(
        Guid householdId,
        int limit,
        LedgerHistoryFilter filter,
        CancellationToken cancellationToken) =>
        filter.From is not null && filter.To is not null && filter.From > filter.To
            ? throw new FinancialRuleException(FinancialErrorCodes.InvalidCategory, "History date range is invalid.")
            : store.GetHistoryAsync(householdId, Math.Clamp(limit, 1, 200), filter, cancellationToken);

    public Task<IReadOnlyList<LedgerHistoryItem>> GetHistoryAsync(
        Guid householdId, int limit, CancellationToken cancellationToken) =>
        GetHistoryAsync(householdId, limit, new LedgerHistoryFilter(), cancellationToken);

    public Task<LedgerWriteResult> PostIncomeAsync(
        Guid actorUserId,
        PostIncomeCommand command,
        CancellationToken cancellationToken) =>
        PostAsync(
            actorUserId,
            IdempotencyOperation.PostIncome,
            command.IdempotencyKey,
            FinancialTransaction.Income(
                command.HouseholdId,
                command.AccountId,
                command.CategoryId,
                Money.Positive(command.AmountCents, command.Currency),
                command.OccurredOn,
                actorUserId,
                command.Description),
            cancellationToken);

    public Task<LedgerWriteResult> PostExpenseAsync(
        Guid actorUserId,
        PostExpenseCommand command,
        CancellationToken cancellationToken) =>
        PostAsync(
            actorUserId,
            IdempotencyOperation.PostExpense,
            command.IdempotencyKey,
            FinancialTransaction.Expense(
                command.HouseholdId,
                command.AccountId,
                command.CategoryId,
                Money.Positive(command.AmountCents, command.Currency),
                command.OccurredOn,
                actorUserId,
                command.Description),
            cancellationToken);

    public Task<LedgerWriteResult> PostTransferAsync(
        Guid actorUserId,
        PostTransferCommand command,
        CancellationToken cancellationToken) =>
        PostAsync(
            actorUserId,
            IdempotencyOperation.PostTransfer,
            command.IdempotencyKey,
            FinancialTransaction.Transfer(
                command.HouseholdId,
                command.SourceAccountId,
                command.DestinationAccountId,
                Money.Positive(command.AmountCents, command.Currency),
                command.OccurredOn,
                actorUserId,
                command.Description),
            cancellationToken);

    public Task<LedgerWriteResult> ReverseAsync(
        Guid actorUserId,
        ReverseTransactionCommand command,
        CancellationToken cancellationToken) =>
        store.ReverseAsync(
            command.HouseholdId,
            command.TransactionId,
            command.OccurredOn,
            command.Description,
            IdempotencyRequest.Create(
                command.HouseholdId,
                actorUserId,
                IdempotencyOperation.ReverseTransaction,
                command.IdempotencyKey,
                command.TransactionId,
                command.OccurredOn,
                command.Description?.Trim()),
            cancellationToken);

    public Task<IReadOnlyList<AccountBalance>> GetBalancesAsync(
        Guid householdId,
        CancellationToken cancellationToken) =>
        store.GetBalancesAsync(householdId, cancellationToken);

    public Task<LedgerReconciliation> ReconcileAsync(
        Guid householdId,
        CancellationToken cancellationToken) =>
        store.ReconcileAsync(householdId, cancellationToken);

    public Task<FinancialDashboard> GetDashboardAsync(
        Guid householdId, int year, int month, CancellationToken cancellationToken)
    {
        if (year is < 2000 or > 9999 || month is < 1 or > 12)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidCategory, "Dashboard period is invalid.");
        }

        var start = new DateOnly(year, month, 1);
        return store.GetDashboardAsync(
            householdId, start, start.AddMonths(1).AddDays(-1), cancellationToken);
    }

    private Task<LedgerWriteResult> PostAsync(
        Guid actorUserId,
        IdempotencyOperation operation,
        Guid idempotencyKey,
        FinancialTransaction transaction,
        CancellationToken cancellationToken)
    {
        var entries = string.Join(
            ';',
            transaction.Entries
                .OrderBy(entry => entry.AccountId)
                .ThenBy(entry => entry.CategoryId)
                .ThenBy(entry => entry.Direction)
                .Select(entry =>
                    $"{entry.AccountId:D},{entry.CategoryId?.ToString("D")},{entry.Direction},{entry.Amount.Cents},{entry.Amount.Currency}"));
        var idempotency = IdempotencyRequest.Create(
            transaction.HouseholdId,
            actorUserId,
            operation,
            idempotencyKey,
            transaction.Kind,
            transaction.OccurredOn,
            transaction.Description,
            entries);
        return store.PostAsync(transaction, idempotency, cancellationToken);
    }
}
