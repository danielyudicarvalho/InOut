using System.Security.Cryptography;
using System.Text.Json;
using InOut.Application.Security;
using InOut.Domain.Financial;
using InOut.Domain.Households;

namespace InOut.Application.Financial.Dashboard;

public sealed record GetExpenseBreakdownQuery(
    Guid ActorUserId, Guid HouseholdId, string Currency,
    int? Year = null, int? Month = null, DateOnly? From = null, DateOnly? To = null,
    int Offset = 0, int Limit = 50);

public sealed record ExpenseBreakdownItem(
    Guid TransactionId, Guid EntryId, Guid AccountId, string AccountName,
    DateOnly OccurredOn, string? Description, string? CategoryName,
    string? IncomeSourceName, long AmountCents, bool IsReversal, Guid? ReversalOf);

public sealed record ExpenseBreakdown(
    DateOnly PeriodStart, DateOnly PeriodEnd, string Currency, long TotalCents,
    bool IsReconciled, int TotalCount, int Offset, string SnapshotId, IReadOnlyList<ExpenseBreakdownItem> Items);

public sealed class GetExpenseBreakdown(
    IHouseholdMembershipReader membershipReader, IDashboardReader dashboardReader)
{
    public async Task<ExpenseBreakdown> ExecuteAsync(GetExpenseBreakdownQuery query, CancellationToken cancellationToken)
    {
        if (!await membershipReader.IsMemberAsync(query.ActorUserId, query.HouseholdId, cancellationToken))
            throw new HouseholdRuleException(HouseholdErrorCodes.MembershipRequired, "The user is not a member of this household.");

        var currency = new Money(0, query.Currency).Currency;
        var period = query.From is not null && query.To is not null
            ? FinancialPeriod.Custom(query.From.Value, query.To.Value)
            : query.Year is not null && query.Month is not null
                ? FinancialPeriod.Monthly(query.Year.Value, query.Month.Value)
                : FinancialPeriod.Monthly(DateTime.UtcNow.Year, DateTime.UtcNow.Month);
        var source = await dashboardReader.ReadAsync(query.ActorUserId, query.HouseholdId, period, cancellationToken);
        var accounts = source.Accounts.Where(account => account.Currency == currency).ToDictionary(account => account.Id);
        var categories = source.Categories.ToDictionary(category => category.Id, category => category.Name);
        var incomeSources = source.IncomeSources.ToDictionary(item => item.Id, item => item.Name);
        var items = source.Postings
            .Where(posting => accounts.ContainsKey(posting.AccountId))
            .Select(posting => new { Posting = posting, Amount = FinancialDashboardCalculator.ExpenseContribution(posting) })
            .Where(item => item.Amount is not null)
            .Select(item => new ExpenseBreakdownItem(
                item.Posting.TransactionId, item.Posting.EntryId, item.Posting.AccountId,
                accounts[item.Posting.AccountId].Name, item.Posting.OccurredOn, item.Posting.Description,
                item.Posting.CategoryId is { } categoryId && categories.TryGetValue(categoryId, out var categoryName) ? categoryName : null,
                item.Posting.IncomeSourceId is { } sourceId && incomeSources.TryGetValue(sourceId, out var sourceName) ? sourceName : null,
                item.Amount!.Value, item.Posting.Kind == FinancialTransactionKind.Reversal, item.Posting.ReversalOf))
            .OrderByDescending(item => item.OccurredOn)
            .ThenByDescending(item => item.TransactionId)
            .ThenBy(item => item.EntryId)
            .ToArray();
        var total = items.Aggregate(0L, (sum, item) => checked(sum + item.AmountCents));
        var snapshotId = Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(items)));
        var offset = Math.Clamp(query.Offset, 0, items.Length);
        var limit = Math.Clamp(query.Limit, 1, 200);
        return new ExpenseBreakdown(period.Start, period.End, currency, total,
            source.PostedTransactionCount == source.EntryTransactionCount, items.Length, offset, snapshotId,
            items.Skip(offset).Take(limit).ToArray());
    }
}
