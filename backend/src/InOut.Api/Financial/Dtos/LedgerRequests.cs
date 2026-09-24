using InOut.Domain.Financial;

namespace InOut.Api.Financial;

public sealed record CreateCategoryRequest(Guid Id, string Name, FinancialFlow Flow, Guid? ParentId);

public sealed record PostIncomeRequest(
    Guid AccountId,
    Guid CategoryId,
    long AmountCents,
    string Currency,
    DateOnly OccurredOn,
    string? Description,
    Guid? IncomeSourceId = null);

public sealed record CreateIncomeSourceRequest(Guid Id, string Name);

public sealed record CreateAccountRequest(
    Guid Id,
    string Name,
    AccountKind Kind,
    string Currency,
    long InitialBalanceCents,
    DateOnly OpeningDate);

public sealed record PostExpenseRequest(
    Guid AccountId,
    Guid CategoryId,
    long AmountCents,
    string Currency,
    DateOnly OccurredOn,
    string? Description);

public sealed record PostTransferRequest(
    Guid SourceAccountId,
    Guid DestinationAccountId,
    long AmountCents,
    string Currency,
    DateOnly OccurredOn,
    string? Description);

public sealed record ReverseTransactionRequest(
    DateOnly OccurredOn,
    string? Description);
