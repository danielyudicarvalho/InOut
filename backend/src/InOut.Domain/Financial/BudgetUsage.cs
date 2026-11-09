namespace InOut.Domain.Financial;

public readonly record struct BudgetExpenseLine(
    Guid TransactionId, DateOnly OccurredOn, string? Description,
    string AccountName, long AmountCents);

public static class BudgetUsage
{
    public static long Spent(
        IEnumerable<DashboardPosting> postings,
        IReadOnlyDictionary<Guid, string> accountCurrencies,
        Guid categoryId,
        string currency)
    {
        long spent = 0;
        foreach (var posting in postings)
        {
            if (posting.CategoryId != categoryId ||
                !accountCurrencies.TryGetValue(posting.AccountId, out var accountCurrency) ||
                accountCurrency != currency)
                continue;
            if (FinancialDashboardCalculator.ExpenseContribution(posting) is { } amount)
                spent = checked(spent + amount);
        }
        return spent;
    }

    public static long Remaining(long limitCents, long spentCents) =>
        checked(limitCents - spentCents);

    public static IReadOnlyList<BudgetExpenseLine> Expenses(
        IEnumerable<DashboardPosting> postings,
        IReadOnlyDictionary<Guid, string> accountCurrencies,
        IReadOnlyDictionary<Guid, string> accountNames,
        Guid categoryId,
        string currency)
    {
        var lines = new Dictionary<Guid, BudgetExpenseLine>();
        foreach (var posting in postings)
        {
            if (posting.CategoryId != categoryId ||
                !accountCurrencies.TryGetValue(posting.AccountId, out var accountCurrency) ||
                accountCurrency != currency ||
                FinancialDashboardCalculator.ExpenseContribution(posting) is not { } amount ||
                amount == 0)
                continue;
            var name = accountNames.TryGetValue(posting.AccountId, out var accountName)
                ? accountName
                : "Conta";
            if (lines.TryGetValue(posting.TransactionId, out var current))
            {
                var names = current.AccountName.Split(", ").Append(name).Distinct();
                lines[posting.TransactionId] = current with
                {
                    AmountCents = checked(current.AmountCents + amount),
                    AccountName = string.Join(", ", names),
                };
            }
            else
            {
                lines[posting.TransactionId] = new BudgetExpenseLine(
                    posting.TransactionId, posting.OccurredOn, posting.Description, name, amount);
            }
        }
        return lines.Values
            .Where(line => line.AmountCents != 0)
            .OrderBy(line => line.OccurredOn)
            .ThenBy(line => line.TransactionId)
            .ToArray();
    }
}
