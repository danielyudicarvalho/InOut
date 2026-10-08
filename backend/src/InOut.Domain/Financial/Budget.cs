namespace InOut.Domain.Financial;

public sealed record Budget(
    Guid Id,
    Guid HouseholdId,
    Guid CategoryId,
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    long LimitCents)
{
    public static Budget Create(
        Guid id,
        Guid householdId,
        Guid categoryId,
        DateOnly periodStart,
        DateOnly periodEnd,
        long limitCents)
    {
        if (id == Guid.Empty || householdId == Guid.Empty || categoryId == Guid.Empty)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidCategory,
                "Budget identifiers are required.");
        }

        if (limitCents <= 0)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidAmount,
                "Budget limit must be positive.");
        }

        if (periodStart > periodEnd)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidPeriod,
                "Budget period start cannot be after period end.");
        }

        return new Budget(id, householdId, categoryId, periodStart, periodEnd, limitCents);
    }

    public Budget UpdateLimit(long newLimitCents)
    {
        if (newLimitCents <= 0)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidAmount,
                "Budget limit must be positive.");
        }

        return this with { LimitCents = newLimitCents };
    }
}
