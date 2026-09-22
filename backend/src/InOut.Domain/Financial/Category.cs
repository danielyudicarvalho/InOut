using InOut.Domain.Utils;

namespace InOut.Domain.Financial;

public sealed record Category(
    Guid Id,
    Guid HouseholdId,
    FinancialFlow Flow,
    DateTimeOffset? ArchivedAt)
{
    public bool IsActive => ArchivedAt is null;

    public static Category Create(Guid id, Guid householdId, string? name, FinancialFlow flow)
    {
        if (id == Guid.Empty || householdId == Guid.Empty || !Enum.IsDefined(flow))
        {
            throw new FinancialRuleException(FinancialErrorCodes.InvalidCategory, "Category identifiers and flow are required.");
        }

        NormalizeName(name);
        return new Category(id, householdId, flow, null);
    }

    public static string NormalizeName(string? name)
    {
        var normalized = StringUtils.TrimToNull(name);
        if (normalized is null || normalized.Length > 80)
        {
            throw new FinancialRuleException(FinancialErrorCodes.InvalidCategory, "Category name must contain between 1 and 80 characters.");
        }

        return normalized;
    }

    public Category Archive(DateTimeOffset at) => IsActive ? this with { ArchivedAt = at } : this;
}
