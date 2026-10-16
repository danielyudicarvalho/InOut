using InOut.Application.Financial;
using InOut.Application.Idempotency;
using InOut.Domain.Financial;
using InOut.Infrastructure.Idempotency;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InOut.Infrastructure.Financial;

public sealed partial class EfLedgerStore(
    InOutDbContext dbContext,
    IIdempotencyPolicy idempotencyPolicy,
    TimeProvider timeProvider) : ILedgerStore
{
    private readonly EfIdempotencyCoordinator idempotency =
        new(dbContext, timeProvider, idempotencyPolicy);

    public async Task<IReadOnlyList<AccountBalance>> GetBalancesAsync(
        Guid actorUserId,
        Guid householdId,
        CancellationToken cancellationToken)
    {
        if (dbContext.Database.CurrentTransaction != null)
        {
            return await GetBalancesInternalAsync(householdId, cancellationToken);
        }

        await using var databaseTransaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
        var balances = await GetBalancesInternalAsync(householdId, cancellationToken);
        await databaseTransaction.CommitAsync(cancellationToken);
        return balances;
    }

    private async Task<IReadOnlyList<AccountBalance>> GetBalancesInternalAsync(
        Guid householdId,
        CancellationToken cancellationToken)
    {
        var rows = await (
            from account in dbContext.Accounts.AsNoTracking()
            where account.HouseholdId == householdId && account.ArchivedAt == null
            join entry in dbContext.Entries.AsNoTracking()
                on new { account.HouseholdId, AccountId = account.Id }
                equals new { entry.HouseholdId, AccountId = entry.AccountId }
                into accountEntries
            select new
            {
                AccountId = account.Id,
                account.Currency,
                BalanceCents = accountEntries.Sum(entry =>
                    (long?)(entry.Direction == EntryDirection.Credit ? entry.AmountCents : -entry.AmountCents)) ?? 0,
            })
            .OrderBy(item => item.AccountId)
            .ToListAsync(cancellationToken);

        return rows
            .Select(item => new AccountBalance(item.AccountId, item.Currency, item.BalanceCents))
            .ToArray();
    }

    public async Task<LedgerReconciliation> ReconcileAsync(
        Guid actorUserId,
        Guid householdId,
        CancellationToken cancellationToken)
    {
        await using var databaseTransaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
        var postedTransactionCount = await dbContext.FinancialTransactions
            .AsNoTracking()
            .LongCountAsync(
                item => item.HouseholdId == householdId &&
                    (item.Status == FinancialTransactionStatus.Posted ||
                        item.Status == FinancialTransactionStatus.Reversed),
                cancellationToken);
        var entryTransactionCount = await dbContext.Entries
            .AsNoTracking()
            .Where(item => item.HouseholdId == householdId)
            .Select(item => item.TransactionId)
            .Distinct()
            .LongCountAsync(cancellationToken);
        var balances = await GetBalancesAsync(actorUserId, householdId, cancellationToken);
        await databaseTransaction.CommitAsync(cancellationToken);
        return new LedgerReconciliation(
            postedTransactionCount == entryTransactionCount,
            postedTransactionCount,
            entryTransactionCount,
            balances);
    }

    private void AddAudit(
        Guid householdId,
        Guid actorUserId,
        string action,
        string entityType,
        Guid entityId) =>
        dbContext.AuditEvents.Add(new AuditEventRecord
        {
            HouseholdId = householdId,
            ActorUserId = actorUserId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
        });

    private Task<int> LockResourceAsync(
        Guid householdId,
        Guid resourceId,
        CancellationToken cancellationToken) =>
        dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"select pg_advisory_xact_lock(hashtextextended({householdId + ":" + resourceId}, 0))",
            cancellationToken);

    private async Task LockAccountsAsync(
        Guid householdId,
        IReadOnlyList<LedgerEntry> entries,
        CancellationToken cancellationToken)
    {
        foreach (var accountId in entries.Select(item => item.AccountId).Distinct().Order())
        {
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"select id from public.accounts where household_id = {householdId} and id = {accountId} for update",
                cancellationToken);
        }
    }
}
