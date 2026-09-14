using InOut.Domain.Financial;

namespace InOut.Application.Financial;

public sealed record PostIncomeCommand(
    Guid HouseholdId,
    Guid AccountId,
    Guid CategoryId,
    long AmountCents,
    string Currency,
    DateOnly OccurredOn,
    Guid IdempotencyKey,
    string? Description);

public sealed record PostExpenseCommand(
    Guid HouseholdId,
    Guid AccountId,
    Guid CategoryId,
    long AmountCents,
    string Currency,
    DateOnly OccurredOn,
    Guid IdempotencyKey,
    string? Description);

public sealed record PostTransferCommand(
    Guid HouseholdId,
    Guid SourceAccountId,
    Guid DestinationAccountId,
    long AmountCents,
    string Currency,
    DateOnly OccurredOn,
    Guid IdempotencyKey,
    string? Description);

public sealed record ReverseTransactionCommand(
    Guid HouseholdId,
    Guid TransactionId,
    DateOnly OccurredOn,
    Guid IdempotencyKey,
    string? Description);

public sealed class LedgerService(ILedgerStore store)
{
    public Task<LedgerWriteResult> PostIncomeAsync(
        Guid actorUserId,
        PostIncomeCommand command,
        CancellationToken cancellationToken) =>
        store.PostAsync(
            FinancialTransaction.Income(
                command.HouseholdId,
                command.AccountId,
                command.CategoryId,
                Money.Positive(command.AmountCents, command.Currency),
                command.OccurredOn,
                command.IdempotencyKey,
                actorUserId,
                command.Description),
            cancellationToken);

    public Task<LedgerWriteResult> PostExpenseAsync(
        Guid actorUserId,
        PostExpenseCommand command,
        CancellationToken cancellationToken) =>
        store.PostAsync(
            FinancialTransaction.Expense(
                command.HouseholdId,
                command.AccountId,
                command.CategoryId,
                Money.Positive(command.AmountCents, command.Currency),
                command.OccurredOn,
                command.IdempotencyKey,
                actorUserId,
                command.Description),
            cancellationToken);

    public Task<LedgerWriteResult> PostTransferAsync(
        Guid actorUserId,
        PostTransferCommand command,
        CancellationToken cancellationToken) =>
        store.PostAsync(
            FinancialTransaction.Transfer(
                command.HouseholdId,
                command.SourceAccountId,
                command.DestinationAccountId,
                Money.Positive(command.AmountCents, command.Currency),
                command.OccurredOn,
                command.IdempotencyKey,
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
            command.IdempotencyKey,
            actorUserId,
            command.OccurredOn,
            command.Description,
            cancellationToken);

    public Task<IReadOnlyList<AccountBalance>> GetBalancesAsync(
        Guid householdId,
        CancellationToken cancellationToken) =>
        store.GetBalancesAsync(householdId, cancellationToken);

    public Task<LedgerReconciliation> ReconcileAsync(
        Guid householdId,
        CancellationToken cancellationToken) =>
        store.ReconcileAsync(householdId, cancellationToken);
}
