using InOut.Domain.Utils;

namespace InOut.Domain.Financial;

public sealed record IncomeSource
{
    public const int MaxNameLength = 80;

    public Guid Id { get; init; }
    public Guid HouseholdId { get; init; }
    public string Name { get; init; }
    public DateTimeOffset? ArchivedAt { get; init; }
    public IncomeSourceStatus Status { get; init; }

    public IncomeSource(
        Guid id,
        Guid householdId,
        string name,
        DateTimeOffset? archivedAt,
        IncomeSourceStatus status = IncomeSourceStatus.Active)
    {
        Id = id;
        HouseholdId = householdId;
        Name = name;
        ArchivedAt = archivedAt;
        Status = archivedAt is not null ? IncomeSourceStatus.Archived : status;
    }

    public bool IsActive => Status == IncomeSourceStatus.Active;
    public bool CanAssignTransaction => IsActive;

    public static IncomeSource Create(Guid id, Guid householdId, string? name)
    {
        var normalized = StringUtils.TrimToNull(name);

        if (id == Guid.Empty || householdId == Guid.Empty || normalized is null || normalized.Length > MaxNameLength)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidIncomeSource,
                $"Income source requires valid identifiers and a name between 1 and {MaxNameLength} characters.");
        }

        return new IncomeSource(id, householdId, normalized, null, IncomeSourceStatus.Active);
    }

    public IncomeSource Archive(DateTimeOffset at) =>
        Status == IncomeSourceStatus.Archived
            ? this
            : this with { ArchivedAt = at, Status = IncomeSourceStatus.Archived };

    public void EnsureCanAssignTransaction()
    {
        if (!CanAssignTransaction)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidIncomeSource,
                "Cannot assign transactions to an inactive or archived income source.");
        }
    }

    public void EnsureBelongsToHousehold(Guid householdId)
    {
        if (HouseholdId != householdId)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidIncomeSource,
                "Income source must belong to the household.");
        }
    }
}