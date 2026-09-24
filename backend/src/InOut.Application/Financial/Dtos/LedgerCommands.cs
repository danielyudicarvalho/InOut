using InOut.Domain.Financial;

namespace InOut.Application.Financial;

public sealed record CreateAccountCommand(
    Guid Id,
    Guid HouseholdId,
    string Name,
    AccountKind Kind,
    string Currency,
    long InitialBalanceCents,
    DateOnly OpeningDate,
    Guid IdempotencyKey);

public sealed record PostIncomeCommand(
    Guid HouseholdId,
    Guid AccountId,
    Guid CategoryId,
    long AmountCents,
    string Currency,
    DateOnly OccurredOn,
    Guid IdempotencyKey,
    string? Description,
    Guid? IncomeSourceId = null);

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
