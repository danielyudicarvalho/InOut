using InOut.Application.Financial;
using InOut.Domain.Financial;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InOut.Infrastructure.Financial;

public sealed class EfLedgerStore(InOutDbContext dbContext) : ILedgerStore
{
    public async Task<LedgerWriteResult> PostAsync(
        FinancialTransaction transaction,
        CancellationToken cancellationToken)
    {
        await using var databaseTransaction =
            await BeginForUserAsync(transaction.CreatedBy, cancellationToken);
        await LockIdempotencyKeyAsync(
            transaction.HouseholdId,
            transaction.IdempotencyKey,
            cancellationToken);

        var existingId = await FindByIdempotencyKeyAsync(
            transaction.HouseholdId,
            transaction.IdempotencyKey,
            cancellationToken);
        if (existingId is not null)
        {
            await databaseTransaction.CommitAsync(cancellationToken);
            return new LedgerWriteResult(existingId.Value, true);
        }

        await ValidateReferencesAsync(transaction, cancellationToken);
        AddTransaction(transaction);
        AddAudit(
            transaction.HouseholdId,
            transaction.CreatedBy,
            "financial.transaction.posted",
            transaction.Id);
        await dbContext.SaveChangesAsync(cancellationToken);
        await databaseTransaction.CommitAsync(cancellationToken);
        return new LedgerWriteResult(transaction.Id, false);
    }

    public async Task<LedgerWriteResult> ReverseAsync(
        Guid householdId,
        Guid transactionId,
        Guid idempotencyKey,
        Guid actorUserId,
        DateOnly occurredOn,
        string? description,
        CancellationToken cancellationToken)
    {
        await using var databaseTransaction =
            await BeginForUserAsync(actorUserId, cancellationToken);
        await LockIdempotencyKeyAsync(householdId, idempotencyKey, cancellationToken);

        var existingId = await FindByIdempotencyKeyAsync(
            householdId,
            idempotencyKey,
            cancellationToken);
        if (existingId is not null)
        {
            await databaseTransaction.CommitAsync(cancellationToken);
            return new LedgerWriteResult(existingId.Value, true);
        }

        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"select id from public.transactions where household_id = {householdId} and id = {transactionId} for update",
            cancellationToken);
        var originalRecord = await dbContext.FinancialTransactions
            .Include(item => item.Entries)
            .SingleOrDefaultAsync(
                item => item.HouseholdId == householdId && item.Id == transactionId,
                cancellationToken);
        if (originalRecord is null)
        {
            throw new FinancialRuleException(
                "transaction_not_found",
                "Transaction was not found.");
        }

        if (!string.Equals(originalRecord.Status, "posted", StringComparison.Ordinal))
        {
            throw new FinancialRuleException(
                "transaction_not_reversible",
                "Only a posted transaction can be reversed.");
        }

        var original = ToDomain(originalRecord);
        var reversal = FinancialTransaction.Reversal(
            original,
            idempotencyKey,
            actorUserId,
            occurredOn,
            description);
        AddTransaction(reversal);
        originalRecord.Status = "reversed";
        AddAudit(householdId, actorUserId, "financial.transaction.reversed", transactionId);
        await dbContext.SaveChangesAsync(cancellationToken);
        await databaseTransaction.CommitAsync(cancellationToken);
        return new LedgerWriteResult(reversal.Id, false);
    }

    public async Task<IReadOnlyList<AccountBalance>> GetBalancesAsync(
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
                    (long?)(entry.Direction == "credit" ? entry.AmountCents : -entry.AmountCents)) ?? 0,
            })
            .OrderBy(item => item.AccountId)
            .ToListAsync(cancellationToken);
        return rows
            .Select(item => new AccountBalance(item.AccountId, item.Currency, item.BalanceCents))
            .ToArray();
    }

    public async Task<LedgerReconciliation> ReconcileAsync(
        Guid householdId,
        CancellationToken cancellationToken)
    {
        var postedTransactionCount = await dbContext.FinancialTransactions
            .AsNoTracking()
            .LongCountAsync(
                item => item.HouseholdId == householdId &&
                    (item.Status == "posted" || item.Status == "reversed"),
                cancellationToken);
        var entryTransactionCount = await dbContext.Entries
            .AsNoTracking()
            .Where(item => item.HouseholdId == householdId)
            .Select(item => item.TransactionId)
            .Distinct()
            .LongCountAsync(cancellationToken);
        var balances = await GetBalancesAsync(householdId, cancellationToken);
        return new LedgerReconciliation(
            postedTransactionCount == entryTransactionCount,
            postedTransactionCount,
            entryTransactionCount,
            balances);
    }

    private async Task ValidateReferencesAsync(
        FinancialTransaction transaction,
        CancellationToken cancellationToken)
    {
        var accountIds = transaction.Entries.Select(entry => entry.AccountId).Distinct().ToArray();
        var accounts = await dbContext.Accounts
            .Where(account =>
                account.HouseholdId == transaction.HouseholdId &&
                accountIds.Contains(account.Id) &&
                account.ArchivedAt == null)
            .ToListAsync(cancellationToken);
        if (accounts.Count != accountIds.Length)
        {
            throw new FinancialRuleException(
                "invalid_account",
                "Every account must be active and belong to the household.");
        }

        if (accounts.Any(account =>
            !string.Equals(
                account.Currency,
                transaction.Entries[0].Amount.Currency,
                StringComparison.Ordinal)))
        {
            throw new FinancialRuleException(
                "currency_mismatch",
                "Transaction currency must match every account.");
        }

        var categoryIds = transaction.Entries
            .Where(entry => entry.CategoryId is not null)
            .Select(entry => entry.CategoryId!.Value)
            .Distinct()
            .ToArray();
        if (categoryIds.Length == 0)
        {
            return;
        }

        var expectedFlow = transaction.Kind is FinancialTransactionKind.Income
            ? "income"
            : "expense";
        var categoryCount = await dbContext.Categories.CountAsync(
            category =>
                category.HouseholdId == transaction.HouseholdId &&
                categoryIds.Contains(category.Id) &&
                category.ArchivedAt == null &&
                category.Flow == expectedFlow,
            cancellationToken);
        if (categoryCount != categoryIds.Length)
        {
            throw new FinancialRuleException(
                "invalid_category",
                "Every category must be active, belong to the household, and match the transaction flow.");
        }
    }

    private void AddTransaction(FinancialTransaction transaction)
    {
        var record = new FinancialTransactionRecord
        {
            Id = transaction.Id,
            HouseholdId = transaction.HouseholdId,
            Kind = transaction.Kind.ToString().ToLowerInvariant(),
            Status = "posted",
            Description = transaction.Description,
            OccurredOn = transaction.OccurredOn,
            IdempotencyKey = transaction.IdempotencyKey,
            ReversalOf = transaction.ReversalOf,
            CreatedBy = transaction.CreatedBy,
            PostedAt = DateTimeOffset.UtcNow,
            Entries = transaction.Entries.Select(entry => new EntryRecord
            {
                Id = entry.Id,
                HouseholdId = transaction.HouseholdId,
                TransactionId = transaction.Id,
                AccountId = entry.AccountId,
                CategoryId = entry.CategoryId,
                Direction = entry.Direction.ToString().ToLowerInvariant(),
                AmountCents = entry.Amount.Cents,
            }).ToList(),
        };
        dbContext.FinancialTransactions.Add(record);
    }

    private void AddAudit(Guid householdId, Guid actorUserId, string action, Guid transactionId) =>
        dbContext.AuditEvents.Add(new AuditEventRecord
        {
            HouseholdId = householdId,
            ActorUserId = actorUserId,
            Action = action,
            EntityType = "transaction",
            EntityId = transactionId,
        });

    private Task<Guid?> FindByIdempotencyKeyAsync(
        Guid householdId,
        Guid idempotencyKey,
        CancellationToken cancellationToken) =>
        dbContext.FinancialTransactions
            .AsNoTracking()
            .Where(item =>
                item.HouseholdId == householdId &&
                item.IdempotencyKey == idempotencyKey)
            .Select(item => (Guid?)item.Id)
            .SingleOrDefaultAsync(cancellationToken);

    private async Task<Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction> BeginForUserAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"select set_config('request.jwt.claim.sub', {userId.ToString()}, true)",
            cancellationToken);
        return transaction;
    }

    private Task<int> LockIdempotencyKeyAsync(
        Guid householdId,
        Guid idempotencyKey,
        CancellationToken cancellationToken) =>
        dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"select pg_advisory_xact_lock(hashtextextended({householdId + ":" + idempotencyKey}, 0))",
            cancellationToken);

    private static FinancialTransaction ToDomain(FinancialTransactionRecord record) =>
        FinancialTransaction.RestorePosted(
            record.Id,
            record.HouseholdId,
            Enum.Parse<FinancialTransactionKind>(record.Kind, true),
            record.Description,
            record.OccurredOn,
            record.IdempotencyKey,
            record.CreatedBy,
            record.ReversalOf,
            record.Entries.Select(entry => new LedgerEntry(
                entry.Id,
                entry.AccountId,
                entry.CategoryId,
                Enum.Parse<EntryDirection>(entry.Direction, true),
                Money.Positive(entry.AmountCents))).ToArray());
}
