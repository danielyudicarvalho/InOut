using InOut.Domain.Utils;

namespace InOut.Domain.Financial;

public sealed record IncomeSource(Guid Id, Guid HouseholdId, string Name, DateTimeOffset? ArchivedAt)
{
    public bool IsActive => ArchivedAt is null;

    public static IncomeSource Create(Guid id, Guid householdId, string? name)
    {
        var normalized = StringUtils.TrimToNull(name);
        if (id == Guid.Empty || householdId == Guid.Empty || normalized is null || normalized.Length > 80)
            throw new FinancialRuleException(FinancialErrorCodes.InvalidIncomeSource,
                "Income source requires identifiers and a name of 1 to 80 characters.");
        return new IncomeSource(id, householdId, normalized, null);
    }

    public IncomeSource Archive(DateTimeOffset at) => IsActive ? this with { ArchivedAt = at } : this;
}
