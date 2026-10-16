using InOut.Domain.Utils;

namespace InOut.Domain.Financial;

public sealed record Category(
    Guid Id,
    Guid HouseholdId,
    string Name,
    FinancialFlow Flow,
    Guid? ParentId,
    DateTimeOffset? ArchivedAt,
    CategoryStatus Status = CategoryStatus.Active)
{
    public CategoryStatus Status { get; init; } = Status != CategoryStatus.Active
        ? Status
        : (ArchivedAt is not null ? CategoryStatus.Archived : CategoryStatus.Active);

    public bool IsActive => Status == CategoryStatus.Active;
    public bool CanAssignTransaction => Status == CategoryStatus.Active;

    public void EnsureCanAssignTransaction(FinancialFlow expectedFlow)
    {
        if (Status != CategoryStatus.Active)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidCategory,
                "Every category must be active, belong to the household, and match the transaction flow.");
        }

        if (Flow != expectedFlow)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidCategory,
                "Every category must be active, belong to the household, and match the transaction flow.");
        }
    }

    public Category Deprecate()
    {
        if (Status == CategoryStatus.Archived)
            throw new FinancialRuleException(FinancialErrorCodes.InvalidCategory, "Archived category cannot be deprecated.");
        return this with { Status = CategoryStatus.Deprecated };
    }

    public static Category Create(
        Guid id,
        Guid householdId,
        string? name,
        FinancialFlow flow,
        Guid? parentId = null)
    {
        if (id == Guid.Empty || householdId == Guid.Empty || !Enum.IsDefined(flow))
        {
            throw new FinancialRuleException(FinancialErrorCodes.InvalidCategory, "Category identifiers and flow are required.");
        }

        if (parentId == id)
        {
            throw new FinancialRuleException(FinancialErrorCodes.InvalidCategory, "Category cannot be its own parent.");
        }

        return new Category(id, householdId, NormalizeName(name), flow, parentId, null, CategoryStatus.Active);
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

    public Category Archive(DateTimeOffset at) =>
        Status != CategoryStatus.Archived
            ? this with { ArchivedAt = at, Status = CategoryStatus.Archived }
            : this;
}
