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
    string Currency,
    GoalStatus Status = GoalStatus.Active)
{
    public string Currency { get; } = new Money(0, Currency).Currency;

    public GoalStatus Status { get; init; } = Status != GoalStatus.Active
        ? Status
        : (ArchivedAt is not null ? GoalStatus.Archived : (AllocatedCents >= TargetCents && TargetCents > 0 ? GoalStatus.Completed : GoalStatus.Active));

    public bool IsActive => Status is GoalStatus.Active or GoalStatus.Paused or GoalStatus.Completed;
    public bool CanAllocate => Status == GoalStatus.Active;

    public void EnsureCanAllocate()
    {
        if (Status != GoalStatus.Active)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidGoalName,
                "Only an active goal can receive an allocation.");
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
        DateOnly? targetDate,
        Guid createdBy,
        string currency) =>
        Restore(
            id,
            householdId,
            name,
            targetCents,
            0,
            targetDate,
            createdBy,
            DateTimeOffset.UtcNow,
            null,
            currency,
            GoalStatus.Active);

    public static Goal Restore(
        Guid id,
        Guid householdId,
        string? name,
        long targetCents,
        long allocatedCents,
        DateOnly? targetDate,
        Guid createdBy,
        DateTimeOffset createdAt,
        DateTimeOffset? archivedAt,
        string currency,
        GoalStatus status)
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

        if (allocatedCents < 0)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidAmount,
                "Allocated amount cannot be negative.");
        }

        return new Goal(
            id,
            householdId,
            NormalizeName(name),
            targetCents,
            allocatedCents,
            targetDate,
            createdBy,
            createdAt,
            archivedAt,
            currency,
            status);
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

    public GoalProgress Allocate(
        IReadOnlyCollection<GoalAllocation> history,
        Guid allocationId,
        long amountCents,
        string currency,
        DateOnly occurredOn,
        Guid actorUserId,
        string? note,
        DateTimeOffset createdAt)
    {
        EnsureCanAllocate();
        EnsureHistoryExplainsProgress(history);
        var allocation = GoalAllocation.Contribution(
            allocationId,
            HouseholdId,
            Id,
            amountCents,
            currency,
            occurredOn,
            note,
            actorUserId,
            createdAt);
        EnsureSameGoal(allocation);
        return new GoalProgress(WithProgress(Net(history) + allocation.SignedCents, GoalStatus.Active), allocation);
    }

    public GoalProgress ReverseAllocation(
        IReadOnlyCollection<GoalAllocation> history,
        Guid reversalId,
        Guid allocationId,
        DateOnly occurredOn,
        Guid actorUserId,
        string? note,
        DateTimeOffset createdAt)
    {
        if (Status == GoalStatus.Archived)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidGoalName,
                "Cannot reverse an allocation on an archived goal.");
        }

        EnsureHistoryExplainsProgress(history);
        var original = history.SingleOrDefault(item => item.Id == allocationId);
        if (original is null)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.GoalAllocationNotFound,
                "Allocation was not found on this goal.");
        }

        if (history.Any(item => item.ReversalOf == original.Id))
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.GoalAllocationNotReversible,
                "This allocation was already reversed.");
        }

        var reversal = GoalAllocation.Reversal(reversalId, original, occurredOn, note, actorUserId, createdAt);
        var requestedStatus = Status == GoalStatus.Paused ? GoalStatus.Paused : GoalStatus.Active;
        return new GoalProgress(WithProgress(Net(history) + reversal.SignedCents, requestedStatus), reversal);
    }

    private Goal WithProgress(long allocatedCents, GoalStatus requestedStatus)
    {
        if (allocatedCents < 0)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidAmount,
                "Allocated amount cannot be negative.");
        }

        // `with` assigns Status directly and does not rerun the constructor initializer.
        var status = requestedStatus switch
        {
            GoalStatus.Paused => GoalStatus.Paused,
            GoalStatus.Archived => GoalStatus.Archived,
            _ => allocatedCents >= TargetCents ? GoalStatus.Completed : GoalStatus.Active,
        };
        return this with { AllocatedCents = allocatedCents, Status = status };
    }

    private void EnsureHistoryExplainsProgress(IReadOnlyCollection<GoalAllocation> history)
    {
        var contributions = new Dictionary<Guid, GoalAllocation>();
        foreach (var item in history)
        {
            EnsureSameGoal(item);
            if (item.Kind != GoalAllocationKind.Contribution)
            {
                continue;
            }

            if (!contributions.TryAdd(item.Id, item))
            {
                throw new FinancialRuleException(
                    FinancialErrorCodes.InvalidGoalAllocation,
                    "Allocation history contains a duplicated contribution.");
            }
        }

        var reversed = new HashSet<Guid>();
        foreach (var item in history)
        {
            if (item.Kind != GoalAllocationKind.Reversal)
            {
                continue;
            }

            if (item.ReversalOf is not Guid originalId
                || !contributions.TryGetValue(originalId, out var original)
                || original.AmountCents != item.AmountCents
                || !reversed.Add(originalId))
            {
                throw new FinancialRuleException(
                    FinancialErrorCodes.InvalidGoalAllocation,
                    "Allocation history contains a reversal that does not match one contribution.");
            }
        }

        if (Net(history) != AllocatedCents)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.GoalProgressUnexplained,
                "Goal progress must equal the net of its allocation history before it can change.");
        }
    }

    private void EnsureSameGoal(GoalAllocation allocation)
    {
        if (allocation.HouseholdId != HouseholdId || allocation.GoalId != Id)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidGoalAllocation,
                "Allocation history must belong to this goal.");
        }

        if (allocation.Currency != Currency)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.CurrencyMismatch,
                "Allocation currency must match the goal currency.");
        }
    }

    private static long Net(IEnumerable<GoalAllocation> history)
    {
        long net = 0;
        foreach (var item in history)
        {
            net = checked(net + item.SignedCents);
        }

        return net;
    }

    public Goal Archive(DateTimeOffset archivedAt) =>
        Status != GoalStatus.Archived
            ? this with { ArchivedAt = archivedAt, Status = GoalStatus.Archived }
            : this;
}

public sealed record GoalProgress(Goal Goal, GoalAllocation Allocation);
