namespace InOut.Domain.Financial;

public sealed record PeriodFactSummary(
    long IncomeCents,
    long ExpenseCents,
    long ResultCents,
    long ConsolidatedBalanceCents);

public sealed record PeriodInterpretationDelta(
    long IncomeDeltaCents,
    long ExpenseDeltaCents,
    long ResultDeltaCents,
    double? IncomePercentageChange,
    double? ExpensePercentageChange,
    double? ResultPercentageChange);

public sealed record CurrencyComparisonResult(
    string Currency,
    PeriodFactSummary CurrentFacts,
    PeriodFactSummary PreviousFacts,
    PeriodInterpretationDelta Deltas);

public sealed record FinancialPeriodComparison(
    FinancialPeriod CurrentPeriod,
    FinancialPeriod PreviousPeriod,
    IReadOnlyList<CurrencyComparisonResult> Currencies);

public static class FinancialPeriodComparator
{
    public static FinancialPeriodComparison Compare(
        FinancialPeriod currentPeriod,
        FinancialPeriod previousPeriod,
        FinancialDashboardTotals currentTotals,
        FinancialDashboardTotals previousTotals)
    {
        var currentCurrencies = currentTotals.Currencies.ToDictionary(c => c.Currency);
        var previousCurrencies = previousTotals.Currencies.ToDictionary(c => c.Currency);
        var allCurrencies = currentCurrencies.Keys
            .Union(previousCurrencies.Keys)
            .OrderBy(c => c)
            .ToArray();

        var results = new List<CurrencyComparisonResult>();
        foreach (var currency in allCurrencies)
        {
            currentCurrencies.TryGetValue(currency, out var current);
            previousCurrencies.TryGetValue(currency, out var previous);

            var currIncome = current?.IncomeCents ?? 0;
            var currExpense = current?.ExpenseCents ?? 0;
            var currResult = current?.ResultCents ?? 0;
            var currBalance = current?.ConsolidatedBalanceCents ?? 0;

            var prevIncome = previous?.IncomeCents ?? 0;
            var prevExpense = previous?.ExpenseCents ?? 0;
            var prevResult = previous?.ResultCents ?? 0;
            var prevBalance = previous?.ConsolidatedBalanceCents ?? 0;

            var currentFacts = new PeriodFactSummary(currIncome, currExpense, currResult, currBalance);
            var previousFacts = new PeriodFactSummary(prevIncome, prevExpense, prevResult, prevBalance);

            var incomeDelta = currIncome - prevIncome;
            var expenseDelta = currExpense - prevExpense;
            var resultDelta = currResult - prevResult;

            var incomePct = CalculatePercentageChange(prevIncome, currIncome);
            var expensePct = CalculatePercentageChange(prevExpense, currExpense);
            var resultPct = CalculatePercentageChange(prevResult, currResult);

            var deltas = new PeriodInterpretationDelta(
                incomeDelta,
                expenseDelta,
                resultDelta,
                incomePct,
                expensePct,
                resultPct);

            results.Add(new CurrencyComparisonResult(currency, currentFacts, previousFacts, deltas));
        }

        return new FinancialPeriodComparison(currentPeriod, previousPeriod, results);
    }

    private static double? CalculatePercentageChange(long previous, long current)
    {
        if (previous == 0)
        {
            return current == 0 ? 0.0 : null;
        }

        return Math.Round((double)(current - previous) / Math.Abs(previous) * 100.0, 2);
    }
}
