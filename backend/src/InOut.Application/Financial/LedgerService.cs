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
        CancellationToken cancellationToken) =>
        store.GetCategoriesAsync(householdId, flow, cancellationToken);

    public Task<IReadOnlyList<LedgerHistoryItem>> GetHistoryAsync(
        Guid householdId,
        int limit,
        CancellationToken cancellationToken) =>
        store.GetHistoryAsync(householdId, Math.Clamp(limit, 1, 200), cancellationToken);

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
