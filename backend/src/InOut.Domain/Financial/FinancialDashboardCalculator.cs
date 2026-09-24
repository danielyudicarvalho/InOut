namespace InOut.Domain.Financial;

public sealed record DashboardAccountSnapshot(
    Guid AccountId,
    string Currency,
    long BalanceCents);

public sealed record DashboardPosting(
    Guid AccountId,
    Guid? CategoryId,
    FinancialTransactionKind Kind,
    FinancialTransactionKind? ReversedKind,
    long AmountCents);

public sealed record DashboardCurrencyTotals(
    string Currency,
    long ConsolidatedBalanceCents,
    long IncomeCents,
    long ExpenseCents)
{
    public long ResultCents => IncomeCents - ExpenseCents;
}

public sealed record DashboardCategoryTotal(
    Guid CategoryId,
    string Currency,
    long AmountCents);

public sealed record FinancialDashboardTotals(
    IReadOnlyList<DashboardCurrencyTotals> Currencies,
    IReadOnlyList<DashboardCategoryTotal> Categories);

public static class FinancialDashboardCalculator
{
    public static FinancialDashboardTotals Calculate(
        IReadOnlyCollection<DashboardAccountSnapshot> accounts,
        IReadOnlyCollection<DashboardPosting> postings)
    {
        var accountById = accounts.ToDictionary(account => account.AccountId);
        var effects = postings
            .Where(posting => accountById.ContainsKey(posting.AccountId))
            .Select(posting => ToEffect(posting, accountById[posting.AccountId].Currency))
            .Where(effect => effect is not null)
            .Select(effect => effect!)
            .ToArray();

        var currencies = accounts
            .GroupBy(account => account.Currency)
            .Select(group =>
            {
                var currencyEffects = effects.Where(effect => effect.Currency == group.Key);
                return new DashboardCurrencyTotals(
                    group.Key,
                    group.Sum(account => account.BalanceCents),
                    currencyEffects.Where(effect => effect.Kind == FinancialTransactionKind.Income)
                        .Sum(effect => effect.SignedAmountCents),
                    currencyEffects.Where(effect => effect.Kind == FinancialTransactionKind.Expense)
                        .Sum(effect => effect.SignedAmountCents));
            })
            .OrderBy(item => item.Currency)
            .ToArray();

        var categories = effects
            .Where(effect => effect.Kind == FinancialTransactionKind.Expense && effect.CategoryId is not null)
            .GroupBy(effect => new { CategoryId = effect.CategoryId!.Value, effect.Currency })
            .Select(group => new DashboardCategoryTotal(
                group.Key.CategoryId,
                group.Key.Currency,
                group.Sum(effect => effect.SignedAmountCents)))
            .Where(item => item.AmountCents != 0)
            .OrderByDescending(item => item.AmountCents)
            .ToArray();

        return new FinancialDashboardTotals(currencies, categories);
    }

    private static PostingEffect? ToEffect(DashboardPosting posting, string currency)
    {
        var effectiveKind = posting.Kind == FinancialTransactionKind.Reversal
            ? posting.ReversedKind
            : posting.Kind;
        if (effectiveKind is not (FinancialTransactionKind.Income or FinancialTransactionKind.Expense))
        {
            return null;
        }

        var multiplier = posting.Kind == FinancialTransactionKind.Reversal ? -1L : 1L;
        return new PostingEffect(
            posting.CategoryId,
            currency,
            effectiveKind.Value,
            checked(posting.AmountCents * multiplier));
    }

    private sealed record PostingEffect(
        Guid? CategoryId,
        string Currency,
        FinancialTransactionKind Kind,
        long SignedAmountCents);
}
