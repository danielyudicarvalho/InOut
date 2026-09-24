using InOut.Application.Financial.Export;
using InOut.Domain.Financial;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InOut.Infrastructure.Financial;

public sealed class EfFinancialExportReader(InOutDbContext dbContext) : IFinancialExportReader
{
    public async Task<IReadOnlyList<FinancialExportRow>> ReadAsync(
        Guid actorUserId,
        Guid householdId,
        CancellationToken cancellationToken)
    {
        await using var snapshot = await dbContext.BeginUserSnapshotAsync(
            actorUserId, cancellationToken);

        var accounts = await dbContext.Accounts.AsNoTracking()
            .Where(account => account.HouseholdId == householdId)
            .ToDictionaryAsync(account => account.Id, cancellationToken);
        var categories = await dbContext.Categories.AsNoTracking()
            .Where(category => category.HouseholdId == householdId)
            .ToDictionaryAsync(category => category.Id, cancellationToken);
        var transactions = await dbContext.FinancialTransactions.AsNoTracking()
            .Include(transaction => transaction.Entries)
            .Where(transaction => transaction.HouseholdId == householdId)
            .OrderBy(transaction => transaction.OccurredOn)
            .ThenBy(transaction => transaction.Id)
            .ToArrayAsync(cancellationToken);

        var rows = new List<FinancialExportRow>();
        foreach (var transaction in transactions)
        {
            if (transaction.Entries.Count == 0)
            {
                rows.Add(ToRow(transaction, null, null, null));
                continue;
            }

            foreach (var entry in transaction.Entries.OrderBy(item => item.Id))
            {
                accounts.TryGetValue(entry.AccountId, out var account);
                var category = entry.CategoryId is { } categoryId &&
                    categories.TryGetValue(categoryId, out var foundCategory)
                    ? foundCategory
                    : null;
                rows.Add(ToRow(transaction, entry, account, category));
            }
        }

        await snapshot.CommitAsync(cancellationToken);
        return rows;
    }

    private static FinancialExportRow ToRow(
        FinancialTransactionRecord transaction,
        EntryRecord? entry,
        AccountRecord? account,
        CategoryRecord? category) => FinancialExportRow.FromHistory(
            transaction.Id,
            transaction.Kind,
            transaction.Status,
            transaction.OccurredOn,
            transaction.CreatedAt,
            transaction.PostedAt,
            transaction.Description,
            transaction.ReversalOf,
            transaction.OpeningAccountId,
            entry is null ? null : new LedgerEntry(
                entry.Id,
                entry.AccountId,
                entry.CategoryId,
                entry.Direction,
                Money.Positive(entry.AmountCents, account?.Currency ??
                    throw new InvalidOperationException("An exported entry must reference a visible account."))),
            account?.Name,
            category?.Name,
            category?.ParentId,
            category?.Flow);
}
