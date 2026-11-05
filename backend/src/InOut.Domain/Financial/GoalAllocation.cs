using InOut.Domain.Utils;

namespace InOut.Domain.Financial;

public sealed record GoalAllocation
{
    private GoalAllocation(
        Guid id,
        Guid householdId,
        Guid goalId,
        long amountCents,
        string currency,
        GoalAllocationKind kind,
        GoalAllocationOrigin origin,
        Guid? reversalOf,
        DateOnly occurredOn,
        string? note,
        Guid createdBy,
        DateTimeOffset createdAt)
    {
        if (id == Guid.Empty || householdId == Guid.Empty || goalId == Guid.Empty || createdBy == Guid.Empty)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidGoalAllocation,
                "Allocation, goal, household, and actor identifiers are required.");
        }

        var amount = Money.Positive(amountCents, currency);
        var normalizedNote = NormalizeNote(note);
        if (kind == GoalAllocationKind.Contribution)
        {
            if (reversalOf is not null || origin is not (GoalAllocationOrigin.Recorded or GoalAllocationOrigin.Opening))
            {
                throw new FinancialRuleException(
                    FinancialErrorCodes.InvalidGoalAllocation,
                    "A contribution must not point at another allocation.");
            }
        }
        else if (reversalOf is null || reversalOf == Guid.Empty || origin != GoalAllocationOrigin.Recorded)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidGoalAllocation,
                "A reversal must point at the contribution it undoes.");
        }

        Id = id;
        HouseholdId = householdId;
        GoalId = goalId;
        AmountCents = amount.Cents;
        Currency = amount.Currency;
        Kind = kind;
        Origin = origin;
        ReversalOf = reversalOf;
        OccurredOn = occurredOn;
        Note = normalizedNote;
        CreatedBy = createdBy;
        CreatedAt = createdAt;
    }

    public Guid Id { get; }

    public Guid HouseholdId { get; }

    public Guid GoalId { get; }

    public long AmountCents { get; }

    public string Currency { get; }

    public GoalAllocationKind Kind { get; }

    public GoalAllocationOrigin Origin { get; }

    public Guid? ReversalOf { get; }

    public DateOnly OccurredOn { get; }

    public string? Note { get; }

    public Guid CreatedBy { get; }

    public DateTimeOffset CreatedAt { get; }

    public long SignedCents => Kind == GoalAllocationKind.Reversal ? -AmountCents : AmountCents;

    public static string? NormalizeNote(string? note)
    {
        var normalized = StringUtils.TrimToNull(note);
        if (normalized?.Length > 500)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.DescriptionTooLong,
                "Allocation note cannot exceed 500 characters.");
        }

        return normalized;
    }

    public static GoalAllocation Contribution(
        Guid id,
        Guid householdId,
        Guid goalId,
        long amountCents,
        string currency,
        DateOnly occurredOn,
        string? note,
        Guid createdBy,
        DateTimeOffset createdAt) =>
        new(
            id,
            householdId,
            goalId,
            amountCents,
            currency,
            GoalAllocationKind.Contribution,
            GoalAllocationOrigin.Recorded,
            null,
            occurredOn,
            note,
            createdBy,
            createdAt);

    public static GoalAllocation Reversal(
        Guid id,
        GoalAllocation original,
        DateOnly occurredOn,
        string? note,
        Guid createdBy,
        DateTimeOffset createdAt)
    {
        if (original.Kind != GoalAllocationKind.Contribution)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.ReversalOfReversal,
                "A reversal cannot reverse another reversal.");
        }

        return new GoalAllocation(
            id,
            original.HouseholdId,
            original.GoalId,
            original.AmountCents,
            original.Currency,
            GoalAllocationKind.Reversal,
            GoalAllocationOrigin.Recorded,
            original.Id,
            occurredOn,
            note,
            createdBy,
            createdAt);
    }

    public static GoalAllocation Restore(
        Guid id,
        Guid householdId,
        Guid goalId,
        long amountCents,
        string currency,
        GoalAllocationKind kind,
        GoalAllocationOrigin origin,
        Guid? reversalOf,
        DateOnly occurredOn,
        string? note,
        Guid createdBy,
        DateTimeOffset createdAt) =>
        new(
            id,
            householdId,
            goalId,
            amountCents,
            currency,
            kind,
            origin,
            reversalOf,
            occurredOn,
            note,
            createdBy,
            createdAt);
}
