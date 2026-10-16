using InOut.Domain.Utils;

namespace InOut.Domain.Financial;

public sealed record Goal(
    Guid Id,
    Guid HouseholdId,
    string Name,
    long TargetCents,
    long AllocatedCents,
    DateOnly? TargetDate,
    Guid CreatedBy,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ArchivedAt)
{
    public bool IsActive => ArchivedAt is null;

    public static Goal Create(
        Guid id,
        Guid householdId,
        string? name,
        long targetCents,
        long initialAllocatedCents,
        DateOnly? targetDate,
        Guid createdBy)
    {
        if (id == Guid.Empty || householdId == Guid.Empty || createdBy == Guid.Empty)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidGoalName,
                "Goal, household, and actor identifiers are required.");
        }

        if (targetCents <= 0)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidAmount,
                "Goal target amount must be positive.");
        }

        if (initialAllocatedCents < 0)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidAmount,
                "Allocated amount cannot be negative.");
        }

        var normalizedName = NormalizeName(name);

        return new Goal(
            id,
            householdId,
            normalizedName,
            targetCents,
            initialAllocatedCents,
            targetDate,
            createdBy,
            DateTimeOffset.UtcNow,
            null);
    }

    public static string NormalizeName(string? name)
    {
        var normalized = StringUtils.TrimToNull(name);
        if (string.IsNullOrEmpty(normalized) || normalized.Length > 120)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidGoalName,
                "Goal name must contain between 1 and 120 characters.");
        }

        return normalized;
    }

    public Goal UpdateAllocated(long newAllocatedCents)
    {
        if (newAllocatedCents < 0)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidAmount,
                "Allocated amount cannot be negative.");
        }

        return this with { AllocatedCents = newAllocatedCents };
    }

    public Goal Archive(DateTimeOffset archivedAt) =>
        IsActive ? this with { ArchivedAt = archivedAt } : this;
}
