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
    DateTimeOffset? ArchivedAt,
    GoalStatus Status = GoalStatus.Active)
{
    public GoalStatus Status { get; init; } = Status != GoalStatus.Active
        ? Status
        : (ArchivedAt is not null ? GoalStatus.Archived : (AllocatedCents >= TargetCents && TargetCents > 0 ? GoalStatus.Completed : GoalStatus.Active));

    public bool IsActive => Status is GoalStatus.Active or GoalStatus.Paused or GoalStatus.Completed;
    public bool CanAllocate => Status == GoalStatus.Active;

    public void EnsureCanAllocate()
    {
        if (Status == GoalStatus.Archived)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidGoalName,
                "Cannot allocate to an archived goal.");
        }

        if (Status == GoalStatus.Paused)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidGoalName,
                "Cannot allocate to a paused goal.");
        }
    }

    public Goal Pause()
    {
        if (Status != GoalStatus.Active)
            throw new FinancialRuleException(FinancialErrorCodes.InvalidGoalName, "Only active goals can be paused.");
        return this with { Status = GoalStatus.Paused };
    }

    public Goal Resume()
    {
        if (Status != GoalStatus.Paused)
            return this;
        return this with { Status = GoalStatus.Active };
    }

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

        var initialStatus = initialAllocatedCents >= targetCents ? GoalStatus.Completed : GoalStatus.Active;
        return new Goal(
            id,
            householdId,
            normalizedName,
            targetCents,
            initialAllocatedCents,
            targetDate,
            createdBy,
            DateTimeOffset.UtcNow,
            null,
            initialStatus);
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
        EnsureCanAllocate();
        if (newAllocatedCents < 0)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidAmount,
                "Allocated amount cannot be negative.");
        }

        var newStatus = newAllocatedCents >= TargetCents ? GoalStatus.Completed : GoalStatus.Active;
        return this with { AllocatedCents = newAllocatedCents, Status = newStatus };
    }

    public Goal Archive(DateTimeOffset archivedAt) =>
        Status != GoalStatus.Archived
            ? this with { ArchivedAt = archivedAt, Status = GoalStatus.Archived }
            : this;
}
