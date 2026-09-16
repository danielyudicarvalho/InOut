using InOut.Application.Financial;
using InOut.Domain.Financial;
using InOut.Domain.Utils;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InOut.Infrastructure.Financial;

public sealed class EfLedgerStore(InOutDbContext dbContext) : ILedgerStore
{
    public async Task<AccountCreationResult> CreateAccountAsync(
        AccountOpening opening,
        Guid actorUserId,
        CancellationToken cancellationToken)
    {
        var account = opening.Account;
        await using var databaseTransaction = await BeginForUserAsync(actorUserId, cancellationToken);
        await LockIdempotencyKeyAsync(
            account.HouseholdId,
            opening.IdempotencyKey,
            cancellationToken);

        var replayedAccount = await dbContext.Accounts
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item => item.HouseholdId == account.HouseholdId &&
                    item.IdempotencyKey == opening.IdempotencyKey,
                cancellationToken);
        if (replayedAccount is not null)
        {
            await EnsureAccountReplayMatchesAsync(replayedAccount, opening, cancellationToken);
            var replayedSummary = await GetAccountSummaryAsync(replayedAccount, cancellationToken);
            await databaseTransaction.CommitAsync(cancellationToken);
            return new AccountCreationResult(replayedSummary, true);
        }

        if (await FindByIdempotencyKeyAsync(
            account.HouseholdId,
            opening.IdempotencyKey,
            cancellationToken) is not null)
        {
            ThrowIdempotencyConflict();
        }

        var existing = await dbContext.Accounts
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == account.Id, cancellationToken);
        if (existing is not null)
        {
            throw new FinancialRuleException("account_conflict", "Account identifier is already in use.");
        }

        var record = new AccountRecord
        {
            Id = account.Id,
            HouseholdId = account.HouseholdId,
            Name = account.Name,
            Kind = account.Kind,
            Currency = account.Currency,
            IdempotencyKey = opening.IdempotencyKey,
            CreatedBy = actorUserId,
        };
        dbContext.Accounts.Add(record);
        AddAudit(account.HouseholdId, actorUserId, "financial.account.created", "account", account.Id);
        await dbContext.SaveChangesAsync(cancellationToken);

        if (opening.OpeningBalance is not null)
        {
            var openingBalance = opening.OpeningBalance;
            AddTransaction(openingBalance);
            AddAudit(
                account.HouseholdId,
                actorUserId,
                "financial.opening_balance.posted",
                "transaction",
                openingBalance.Id);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        await databaseTransaction.CommitAsync(cancellationToken);
        var initialBalanceCents = opening.OpeningBalance?.Entries.Single().Amount.Cents ?? 0;
        return new AccountCreationResult(
            new AccountSummary(account.Id, account.Name, account.Kind, account.Currency, initialBalanceCents, null),
            false);
    }

    public async Task<IReadOnlyList<AccountSummary>> GetAccountsAsync(
        Guid householdId,
        bool includeArchived,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Accounts.AsNoTracking().Where(item => item.HouseholdId == householdId);
        if (!includeArchived)
        {
            query = query.Where(item => item.ArchivedAt == null);
        }

        var rows = await query
            .OrderBy(item => item.Name)
            .Select(item => new
            {
                item.Id,
                item.Name,
                item.Kind,
                item.Currency,
                BalanceCents = dbContext.Entries
                    .Where(entry => entry.HouseholdId == householdId && entry.AccountId == item.Id)
                    .Sum(entry => (long?)(entry.Direction == EntryDirection.Credit ? entry.AmountCents : -entry.AmountCents)) ?? 0,
                item.ArchivedAt,
            })
            .ToListAsync(cancellationToken);
        return rows
            .Select(item => new AccountSummary(
                item.Id,
                item.Name,
                item.Kind,
                item.Currency,
                item.BalanceCents,
                item.ArchivedAt))
            .ToArray();
    }

    public async Task ArchiveAccountAsync(
        Guid householdId,
        Guid accountId,
        Guid actorUserId,
        CancellationToken cancellationToken)
    {
        await using var databaseTransaction = await BeginForUserAsync(actorUserId, cancellationToken);
        var account = await dbContext.Accounts.SingleOrDefaultAsync(
            item => item.HouseholdId == householdId && item.Id == accountId,
            cancellationToken);
        if (account is null)
        {
            throw new FinancialRuleException("account_not_found", "Account was not found.");
        }

        var archived = new Account(
            account.Id,
            account.HouseholdId,
            account.Name,
            account.Kind,
            account.Currency,
            account.ArchivedAt)
            .Archive(DateTimeOffset.UtcNow);
        if (account.ArchivedAt != archived.ArchivedAt)
        {
            account.ArchivedAt = archived.ArchivedAt;
            AddAudit(householdId, actorUserId, "financial.account.archived", "account", accountId);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        await databaseTransaction.CommitAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<CategorySummary>> GetCategoriesAsync(
        Guid householdId,
        FinancialFlow? flow,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Categories
            .AsNoTracking()
            .Where(item => item.HouseholdId == householdId && item.ArchivedAt == null);
        if (flow is not null)
        {
            query = query.Where(item => item.Flow == flow.Value);
        }

        return await query
            .OrderBy(item => item.Name)
            .Select(item => new CategorySummary(
                item.Id,
                item.Name,
                item.Flow))
            .ToArrayAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<LedgerHistoryItem>> GetHistoryAsync(
        Guid householdId,
        int limit,
        CancellationToken cancellationToken)
    {
        var rows = await (
            from transaction in dbContext.FinancialTransactions.AsNoTracking()
            where transaction.HouseholdId == householdId
            from entry in transaction.Entries
            join account in dbContext.Accounts.AsNoTracking()
                on new { entry.HouseholdId, Id = entry.AccountId }
                equals new { account.HouseholdId, account.Id }
            orderby transaction.OccurredOn descending, transaction.PostedAt descending, entry.Id
            select new
            {
                TransactionId = transaction.Id,
                transaction.Kind,
                transaction.Status,
                transaction.Description,
                transaction.ReversalOf,
                transaction.OccurredOn,
                transaction.PostedAt,
                transaction.CreatedBy,
                entry.AccountId,
                AccountName = account.Name,
                entry.Direction,
                entry.AmountCents,
                account.Currency,
            })
            .Take(limit)
            .ToListAsync(cancellationToken);
        return rows
            .Select(item => new LedgerHistoryItem(
                item.TransactionId,
                item.Kind,
                item.Status,
                item.Description,
                item.ReversalOf,
                item.OccurredOn,
                item.PostedAt!.Value,
                item.CreatedBy,
                item.AccountId,
                item.AccountName,
                item.Direction,
                item.AmountCents,
                item.Currency))
            .ToArray();
    }

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

        await EnsureKeyIsNotUsedByAccountAsync(
            transaction.HouseholdId,
            transaction.IdempotencyKey,
            cancellationToken);

        var existingId = await FindByIdempotencyKeyAsync(
            transaction.HouseholdId,
            transaction.IdempotencyKey,
            cancellationToken);
        if (existingId is not null)
        {
            await EnsureTransactionReplayMatchesAsync(
                existingId.Value,
                transaction,
                cancellationToken);
            await databaseTransaction.CommitAsync(cancellationToken);
            return new LedgerWriteResult(existingId.Value, true);
        }

        await ValidateReferencesAsync(transaction, cancellationToken);
        AddTransaction(transaction);
        AddAudit(transaction.HouseholdId, transaction.CreatedBy, "financial.transaction.posted", "transaction", transaction.Id);
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
        await EnsureKeyIsNotUsedByAccountAsync(householdId, idempotencyKey, cancellationToken);

        var existingId = await FindByIdempotencyKeyAsync(
            householdId,
            idempotencyKey,
            cancellationToken);
        if (existingId is not null)
        {
            await EnsureReversalReplayMatchesAsync(
                existingId.Value,
                transactionId,
                actorUserId,
                occurredOn,
                description,
                cancellationToken);
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

        var original = ToDomain(originalRecord);
        var reversal = FinancialTransaction.Reversal(
            original,
            idempotencyKey,
            actorUserId,
            occurredOn,
            description);
        AddTransaction(reversal);
        originalRecord.Status = FinancialTransactionStatus.Reversed;
        AddAudit(householdId, actorUserId, "financial.transaction.reversed", "transaction", transactionId);
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
                    (long?)(entry.Direction == EntryDirection.Credit ? entry.AmountCents : -entry.AmountCents)) ?? 0,
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
                    (item.Status == FinancialTransactionStatus.Posted ||
                        item.Status == FinancialTransactionStatus.Reversed),
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
        var accountRecords = await dbContext.Accounts
            .Where(account =>
                account.HouseholdId == transaction.HouseholdId && accountIds.Contains(account.Id))
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        var categoryIds = transaction.Entries
            .Where(entry => entry.CategoryId is not null)
            .Select(entry => entry.CategoryId!.Value)
            .Distinct()
            .ToArray();
        var categoryRecords = await dbContext.Categories
            .Where(category =>
                category.HouseholdId == transaction.HouseholdId && categoryIds.Contains(category.Id))
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        transaction.ValidateReferences(
            accountRecords.Select(ToDomain).ToArray(),
            categoryRecords.Select(ToDomain).ToArray());
    }

    private void AddTransaction(FinancialTransaction transaction)
    {
        var record = new FinancialTransactionRecord
        {
            Id = transaction.Id,
            HouseholdId = transaction.HouseholdId,
            Kind = transaction.Kind,
            Status = FinancialTransactionStatus.Posted,
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
                Direction = entry.Direction,
                AmountCents = entry.Amount.Cents,
                CreatedBy = transaction.CreatedBy,
            }).ToList(),
        };
        dbContext.FinancialTransactions.Add(record);
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

    private async Task<AccountSummary> GetAccountSummaryAsync(
        AccountRecord account,
        CancellationToken cancellationToken)
    {
        var balance = await dbContext.Entries
            .AsNoTracking()
            .Where(entry => entry.HouseholdId == account.HouseholdId && entry.AccountId == account.Id)
            .SumAsync(
                entry => (long?)(entry.Direction == EntryDirection.Credit ? entry.AmountCents : -entry.AmountCents),
                cancellationToken) ?? 0;
        return new AccountSummary(
            account.Id,
            account.Name,
            account.Kind,
            account.Currency,
            balance,
            account.ArchivedAt);
    }

    private static Account ToDomain(AccountRecord record) => new(
        record.Id,
        record.HouseholdId,
        record.Name,
        record.Kind,
        record.Currency,
        record.ArchivedAt);

    private static Category ToDomain(CategoryRecord record) => new(
        record.Id,
        record.HouseholdId,
        record.Flow,
        record.ArchivedAt);

    private async Task EnsureAccountReplayMatchesAsync(
        AccountRecord persisted,
        AccountOpening requested,
        CancellationToken cancellationToken)
    {
        var account = requested.Account;
        if (persisted.Id != account.Id ||
            persisted.Name != account.Name ||
            persisted.Kind != account.Kind ||
            persisted.Currency != account.Currency)
        {
            ThrowIdempotencyConflict();
        }

        var existingOpeningId = await FindByIdempotencyKeyAsync(
            account.HouseholdId,
            requested.IdempotencyKey,
            cancellationToken);
        if (requested.OpeningBalance is null)
        {
            if (existingOpeningId is not null)
            {
                ThrowIdempotencyConflict();
            }

            return;
        }

        if (existingOpeningId is null)
        {
            ThrowIdempotencyConflict();
        }

        await EnsureTransactionReplayMatchesAsync(
            existingOpeningId.Value,
            requested.OpeningBalance,
            cancellationToken);
    }

    private async Task EnsureTransactionReplayMatchesAsync(
        Guid persistedId,
        FinancialTransaction requested,
        CancellationToken cancellationToken)
    {
        var persisted = await dbContext.FinancialTransactions
            .AsNoTracking()
            .Include(item => item.Entries)
            .SingleAsync(item => item.Id == persistedId, cancellationToken);
        if (persisted.Kind != requested.Kind ||
            persisted.Description != requested.Description ||
            persisted.OccurredOn != requested.OccurredOn ||
            persisted.ReversalOf != requested.ReversalOf ||
            persisted.CreatedBy != requested.CreatedBy ||
            !EntriesMatch(persisted.Entries, requested.Entries))
        {
            ThrowIdempotencyConflict();
        }

        var accountIds = requested.Entries.Select(entry => entry.AccountId).ToArray();
        var currencies = await dbContext.Accounts
            .AsNoTracking()
            .Where(item =>
                item.HouseholdId == requested.HouseholdId &&
                accountIds.Contains(item.Id))
            .Select(item => item.Currency)
            .Distinct()
            .ToArrayAsync(cancellationToken);
        if (currencies.Length != 1 || currencies[0] != requested.Entries[0].Amount.Currency)
        {
            ThrowIdempotencyConflict();
        }
    }

    private async Task EnsureReversalReplayMatchesAsync(
        Guid persistedId,
        Guid reversedTransactionId,
        Guid actorUserId,
        DateOnly occurredOn,
        string? description,
        CancellationToken cancellationToken)
    {
        var persisted = await dbContext.FinancialTransactions
            .AsNoTracking()
            .SingleAsync(item => item.Id == persistedId, cancellationToken);
        if (persisted.Kind != FinancialTransactionKind.Reversal ||
            persisted.ReversalOf != reversedTransactionId ||
            persisted.CreatedBy != actorUserId ||
            persisted.OccurredOn != occurredOn ||
            persisted.Description != StringUtils.TrimToNull(description))
        {
            ThrowIdempotencyConflict();
        }
    }

    private static bool EntriesMatch(
        IReadOnlyCollection<EntryRecord> persisted,
        IReadOnlyList<LedgerEntry> requested) =>
        persisted.Count == requested.Count && requested.All(candidate =>
            persisted.Any(item =>
                item.AccountId == candidate.AccountId &&
                item.CategoryId == candidate.CategoryId &&
                item.Direction == candidate.Direction &&
                item.AmountCents == candidate.Amount.Cents));

    private static void ThrowIdempotencyConflict() =>
        throw new FinancialRuleException(
            "idempotency_conflict",
            "Idempotency key was already used with a different request.");

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

    private async Task EnsureKeyIsNotUsedByAccountAsync(
        Guid householdId,
        Guid idempotencyKey,
        CancellationToken cancellationToken)
    {
        if (await dbContext.Accounts.AsNoTracking().AnyAsync(
            item => item.HouseholdId == householdId && item.IdempotencyKey == idempotencyKey,
            cancellationToken))
        {
            ThrowIdempotencyConflict();
        }
    }

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
            record.Kind,
            record.Description,
            record.OccurredOn,
            record.IdempotencyKey,
            record.CreatedBy,
            record.ReversalOf,
            record.Status,
            record.Entries.Select(entry => new LedgerEntry(
                entry.Id,
                entry.AccountId,
                entry.CategoryId,
                entry.Direction,
                Money.Positive(entry.AmountCents))).ToArray());
}
