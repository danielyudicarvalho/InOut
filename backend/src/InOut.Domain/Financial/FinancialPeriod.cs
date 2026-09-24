namespace InOut.Domain.Financial;

public readonly record struct FinancialPeriod
{
    private FinancialPeriod(DateOnly start, DateOnly end)
    {
        Start = start;
        End = end;
    }

    public DateOnly Start { get; }

    public DateOnly End { get; }

    public static FinancialPeriod Monthly(int year, int month)
    {
        if (year is < 2000 or > 9999 || month is < 1 or > 12)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidPeriod,
                "Financial period is invalid.");
        }

        var start = new DateOnly(year, month, 1);
        return new FinancialPeriod(start, start.AddMonths(1).AddDays(-1));
    }
}
