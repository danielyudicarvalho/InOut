using System.Net;
using InOut.Application.Financial;
using InOut.Application.Idempotency;
using InOut.Domain.Financial;
using InOut.Infrastructure.Idempotency;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace InOut.Infrastructure.Financial;

public sealed partial class EfLedgerStore(
    InOutDbContext dbContext,
    IIdempotencyPolicy idempotencyPolicy,
    TimeProvider timeProvider) : ILedgerStore
{
    private readonly EfIdempotencyCoordinator idempotency =
        new(dbContext, timeProvider, idempotencyPolicy);

    public async Task<AccountCreationResult> CreateAccountAsync(
        AccountOpening opening,
        IdempotencyRequest idempotencyRequest,
        CancellationToken cancellationToken)
    {
        var account = opening.Account;
        await using var databaseTransaction = await dbContext.BeginUserTransactionAsync(
            idempotencyRequest.ActorUserId, cancellationToken);
        var acquisition = await idempotency.AcquireAsync<AccountCreationResult>(
            idempotencyRequest,
            cancellationToken);
        if (acquisition.IsReplay)
        {
            await databaseTransaction.CommitAsync(cancellationToken);
            return acquisition.Response! with { Replayed = true };
        }

        await LockResourceAsync(
            account.HouseholdId,
            account.Id,
            cancellationToken);

        var existingAccount = await dbContext.Accounts
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == account.Id, cancellationToken);
        if (existingAccount is not null)
        {
            throw new FinancialRuleException(FinancialErrorCodes.AccountConflict, "Account identifier is already in use.");
        }

        var record = new AccountRecord
        {
            Id = account.Id,
            HouseholdId = account.HouseholdId,
            Name = account.Name,
            Kind = account.Kind,
            Currency = account.Currency,
            CreatedBy = idempotencyRequest.ActorUserId,
        };
        dbContext.Accounts.Add(record);
        AddAudit(
            account.HouseholdId,
            idempotencyRequest.ActorUserId,
            PersistenceVocabulary.AuditActions.AccountCreated,
            PersistenceVocabulary.EntityTypes.Account,
            account.Id);
        idempotency.AddOutboxEvent(
            account.HouseholdId,
            PersistenceVocabulary.EntityTypes.Account,
            account.Id,
            1,
            PersistenceVocabulary.AuditActions.AccountCreated,
            new { account.Id, account.HouseholdId, account.Name, account.Kind, account.Currency });
        await dbContext.SaveChangesAsync(cancellationToken);

        if (opening.OpeningBalance is not null)
        {
            var openingBalance = opening.OpeningBalance;
            AddTransaction(openingBalance);
            AddAudit(
                account.HouseholdId,
                idempotencyRequest.ActorUserId,
                PersistenceVocabulary.AuditActions.OpeningBalancePosted,
                PersistenceVocabulary.EntityTypes.Transaction,
                openingBalance.Id);
            idempotency.AddOutboxEvent(
                account.HouseholdId,
                PersistenceVocabulary.EntityTypes.Transaction,
                openingBalance.Id,
                1,
                PersistenceVocabulary.AuditActions.OpeningBalancePosted,
                new { openingBalance.Id, openingBalance.HouseholdId, AccountId = account.Id });
        }

        var initialBalanceCents = opening.OpeningBalance?.Entries.Single().Amount.Cents ?? 0;
        var result = new AccountCreationResult(
            new AccountSummary(account.Id, account.Name, account.Kind, account.Currency, initialBalanceCents, null),
            false);
        idempotency.Complete(
            acquisition.Record,
            result,
            (int)HttpStatusCode.Created,
            PersistenceVocabulary.EntityTypes.Account,
            account.Id);
        await dbContext.SaveChangesAsync(cancellationToken);
        await databaseTransaction.CommitAsync(cancellationToken);
        return result;
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
        await using var databaseTransaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
        var account = await dbContext.Accounts.SingleOrDefaultAsync(
            item => item.HouseholdId == householdId && item.Id == accountId,
            cancellationToken);
        if (account is null)
        {
            throw new FinancialRuleException(FinancialErrorCodes.AccountNotFound, "Account was not found.");
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
            AddAudit(
                householdId,
                actorUserId,
                PersistenceVocabulary.AuditActions.AccountArchived,
                PersistenceVocabulary.EntityTypes.Account,
                accountId);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        await databaseTransaction.CommitAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<CategorySummary>> GetCategoriesAsync(
        Guid householdId,
        FinancialFlow? flow,
        bool includeArchived,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Categories
            .AsNoTracking()
            .Where(item => item.HouseholdId == householdId);
        if (!includeArchived)
        {
            query = query.Where(item => item.ArchivedAt == null);
        }
        if (flow is not null)
        {
            query = query.Where(item => item.Flow == flow.Value);
        }

        return await query
            .OrderBy(item => item.Name)
            .Select(item => new CategorySummary(
                item.Id,
                item.Name,
                item.Flow,
                item.ParentId,
                item.ArchivedAt))
            .ToArrayAsync(cancellationToken);
    }

    public Task<IReadOnlyList<CategorySummary>> GetCategoriesAsync(
        Guid householdId, FinancialFlow? flow, CancellationToken cancellationToken) =>
        GetCategoriesAsync(householdId, flow, false, cancellationToken);

    public async Task<CategorySummary> CreateCategoryAsync(
        Guid householdId, Guid actorUserId, Guid id, string name,
        FinancialFlow flow, Guid? parentId, IdempotencyRequest idempotencyRequest,
        CancellationToken cancellationToken)
    {
        var category = Category.Create(id, householdId, name, flow, parentId);
        await using var databaseTransaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
        var acquisition = await idempotency.AcquireAsync<CategorySummary>(
            idempotencyRequest,
            cancellationToken);
        if (acquisition.IsReplay)
        {
            await databaseTransaction.CommitAsync(cancellationToken);
            return acquisition.Response!;
        }

        if (parentId is not null)
        {
            await LockResourceAsync(householdId, parentId.Value, cancellationToken);
            var parent = await dbContext.Categories.AsNoTracking().SingleOrDefaultAsync(
                item => item.HouseholdId == householdId && item.Id == parentId, cancellationToken);
            if (parent is null || parent.ParentId is not null || parent.ArchivedAt is not null || parent.Flow != flow)
            {
                throw new FinancialRuleException(FinancialErrorCodes.InvalidCategory,
                    "Subcategory requires an active root category with the same flow in this household.");
            }
        }

        dbContext.Categories.Add(new CategoryRecord
        {
            Id = category.Id,
            HouseholdId = householdId,
            ParentId = category.ParentId,
            Name = category.Name,
            Flow = category.Flow,
            CreatedBy = actorUserId,
        });
        AddAudit(householdId, actorUserId, PersistenceVocabulary.AuditActions.CategoryCreated,
            PersistenceVocabulary.EntityTypes.Category, id);
        idempotency.AddOutboxEvent(
            householdId,
            PersistenceVocabulary.EntityTypes.Category,
            id,
            1,
            PersistenceVocabulary.AuditActions.CategoryCreated,
            new { category.Id, category.HouseholdId, category.Name, category.Flow, category.ParentId });
        var result = new CategorySummary(
            category.Id,
            category.Name,
            category.Flow,
            category.ParentId,
            category.ArchivedAt);
        idempotency.Complete(
            acquisition.Record,
            result,
            (int)HttpStatusCode.Created,
            PersistenceVocabulary.EntityTypes.Category,
            id);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await databaseTransaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException error) when (error.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new FinancialRuleException(FinancialErrorCodes.CategoryConflict, "Category name or identifier already exists.");
        }

        return result;
    }

    public async Task ArchiveCategoryAsync(
        Guid householdId, Guid categoryId, Guid actorUserId, CancellationToken cancellationToken)
    {
        await using var databaseTransaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
        await LockResourceAsync(householdId, categoryId, cancellationToken);
        var record = await dbContext.Categories.SingleOrDefaultAsync(
            item => item.HouseholdId == householdId && item.Id == categoryId, cancellationToken);
        if (record is null)
        {
            throw new FinancialRuleException(FinancialErrorCodes.CategoryNotFound, "Category was not found.");
        }

        if (record.ArchivedAt is null)
        {
            if (await dbContext.Categories.AnyAsync(
                item => item.HouseholdId == householdId && item.ParentId == categoryId && item.ArchivedAt == null,
                cancellationToken))
            {
                throw new FinancialRuleException(FinancialErrorCodes.CategoryHasActiveChildren,
                    "Archive active subcategories first.");
            }

            record.ArchivedAt = DateTimeOffset.UtcNow;
            AddAudit(householdId, actorUserId, PersistenceVocabulary.AuditActions.CategoryArchived,
                PersistenceVocabulary.EntityTypes.Category, categoryId);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        await databaseTransaction.CommitAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<LedgerHistoryItem>> GetHistoryAsync(
        Guid householdId,
        int limit,
        LedgerHistoryFilter filter,
        CancellationToken cancellationToken)
    {
        var transactions = dbContext.FinancialTransactions.AsNoTracking()
            .Where(item => item.HouseholdId == householdId);
        if (filter.From is not null)
            transactions = transactions.Where(item => item.OccurredOn >= filter.From.Value);
        if (filter.To is not null)
            transactions = transactions.Where(item => item.OccurredOn <= filter.To.Value);
        if (filter.Kind is not null)
            transactions = transactions.Where(item => item.Kind == filter.Kind.Value);

        var rows = await (
            from transaction in transactions
            from entry in transaction.Entries
            where (filter.AccountId == null || entry.AccountId == filter.AccountId)
                && (filter.CategoryId == null || entry.CategoryId == filter.CategoryId)
            join account in dbContext.Accounts.AsNoTracking()
                on new { entry.HouseholdId, Id = entry.AccountId }
                equals new { account.HouseholdId, account.Id }
            join category in dbContext.Categories.AsNoTracking()
                on new { entry.HouseholdId, Id = entry.CategoryId }
                equals new { category.HouseholdId, Id = (Guid?)category.Id } into categoryRows
            from category in categoryRows.DefaultIfEmpty()
            join source in dbContext.IncomeSources.AsNoTracking()
                on new { transaction.HouseholdId, Id = transaction.IncomeSourceId }
                equals new { source.HouseholdId, Id = (Guid?)source.Id } into sourceRows
            from source in sourceRows.DefaultIfEmpty()
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
                entry.CategoryId,
                CategoryName = category == null ? null : category.Name,
                transaction.IncomeSourceId,
                IncomeSourceName = source == null ? null : source.Name,
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
                item.CategoryId,
                item.CategoryName,
                item.Direction,
                item.AmountCents,
                item.Currency,
                item.IncomeSourceId,
                item.IncomeSourceName))
            .ToArray();
    }

    public Task<IReadOnlyList<LedgerHistoryItem>> GetHistoryAsync(
        Guid householdId, int limit, CancellationToken cancellationToken) =>
        GetHistoryAsync(householdId, limit, new LedgerHistoryFilter(), cancellationToken);

    public async Task<LedgerWriteResult> PostAsync(
        FinancialTransaction transaction,
        IdempotencyRequest idempotencyRequest,
        CancellationToken cancellationToken)
    {
        await using var databaseTransaction =
            await dbContext.BeginUserTransactionAsync(transaction.CreatedBy, cancellationToken);
        var acquisition = await idempotency.AcquireAsync<LedgerWriteResult>(
            idempotencyRequest,
            cancellationToken);
        if (acquisition.IsReplay)
        {
            await databaseTransaction.CommitAsync(cancellationToken);
            return acquisition.Response! with { Replayed = true };
        }

        await LockAccountsAsync(transaction.HouseholdId, transaction.Entries, cancellationToken);
        await ValidateReferencesAsync(transaction, cancellationToken);
        if (transaction.IncomeSourceId is { } sourceId &&
            !await dbContext.IncomeSources.AnyAsync(source =>
                source.HouseholdId == transaction.HouseholdId && source.Id == sourceId && source.ArchivedAt == null, cancellationToken))
            throw new FinancialRuleException(FinancialErrorCodes.InvalidIncomeSource,
                "Income source must be active and belong to the household.");
        AddTransaction(transaction);
        AddAudit(
            transaction.HouseholdId,
            transaction.CreatedBy,
            PersistenceVocabulary.AuditActions.TransactionPosted,
            PersistenceVocabulary.EntityTypes.Transaction,
            transaction.Id);
        idempotency.AddOutboxEvent(
            transaction.HouseholdId,
            PersistenceVocabulary.EntityTypes.Transaction,
            transaction.Id,
            1,
            PersistenceVocabulary.AuditActions.TransactionPosted,
            new { transaction.Id, transaction.HouseholdId, transaction.Kind, transaction.OccurredOn });
        var result = new LedgerWriteResult(transaction.Id, false);
        idempotency.Complete(
            acquisition.Record,
            result,
            (int)HttpStatusCode.Created,
            PersistenceVocabulary.EntityTypes.Transaction,
            transaction.Id);
        await dbContext.SaveChangesAsync(cancellationToken);
        await databaseTransaction.CommitAsync(cancellationToken);
        return result;
    }

    public async Task<LedgerWriteResult> ReverseAsync(
        Guid householdId,
        Guid transactionId,
        DateOnly occurredOn,
        string? description,
        IdempotencyRequest idempotencyRequest,
        CancellationToken cancellationToken)
    {
        await using var databaseTransaction =
            await dbContext.BeginUserTransactionAsync(idempotencyRequest.ActorUserId, cancellationToken);
        var acquisition = await idempotency.AcquireAsync<LedgerWriteResult>(
            idempotencyRequest,
            cancellationToken);
        if (acquisition.IsReplay)
        {
            await databaseTransaction.CommitAsync(cancellationToken);
            return acquisition.Response! with { Replayed = true };
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
                FinancialErrorCodes.TransactionNotFound,
                "Transaction was not found.");
        }

        var original = ToDomain(originalRecord);
        var reversal = FinancialTransaction.Reversal(
            original,
            idempotencyRequest.ActorUserId,
            occurredOn,
            description);
        AddTransaction(reversal);
        originalRecord.Status = FinancialTransactionStatus.Reversed;
        AddAudit(
            householdId,
            idempotencyRequest.ActorUserId,
            PersistenceVocabulary.AuditActions.TransactionReversed,
            PersistenceVocabulary.EntityTypes.Transaction,
            transactionId);
        idempotency.AddOutboxEvent(
            householdId,
            PersistenceVocabulary.EntityTypes.Transaction,
            transactionId,
            2,
            PersistenceVocabulary.AuditActions.TransactionReversed,
            new { TransactionId = transactionId, ReversalId = reversal.Id, OccurredOn = occurredOn });
        var result = new LedgerWriteResult(reversal.Id, false);
        idempotency.Complete(
            acquisition.Record,
            result,
            (int)HttpStatusCode.Created,
            PersistenceVocabulary.EntityTypes.Transaction,
            reversal.Id);
        await dbContext.SaveChangesAsync(cancellationToken);
        await databaseTransaction.CommitAsync(cancellationToken);
        return result;
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
            ReversalOf = transaction.ReversalOf,
            IncomeSourceId = transaction.IncomeSourceId,
            OpeningAccountId = transaction.Kind == FinancialTransactionKind.OpeningBalance
                ? transaction.Entries.Single().AccountId
                : null,
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
        record.Name,
        record.Flow,
        record.ParentId,
        record.ArchivedAt);

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

    private static FinancialTransaction ToDomain(FinancialTransactionRecord record) =>
        FinancialTransaction.RestorePosted(
            record.Id,
            record.HouseholdId,
            record.Kind,
            record.Description,
            record.OccurredOn,
            record.CreatedBy,
            record.ReversalOf,
            record.Status,
            record.Entries.Select(entry => new LedgerEntry(
                entry.Id,
                entry.AccountId,
                entry.CategoryId,
                entry.Direction,
                Money.Positive(entry.AmountCents))).ToArray(),
            record.IncomeSourceId);
}
