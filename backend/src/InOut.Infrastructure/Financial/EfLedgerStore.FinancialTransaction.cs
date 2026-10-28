using System.Net;
using InOut.Application.Financial;
using InOut.Application.Idempotency;
using InOut.Domain.Financial;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InOut.Infrastructure.Financial;

public sealed partial class EfLedgerStore
{
    public async Task<IReadOnlyList<LedgerHistoryItem>> GetHistoryAsync(
        Guid actorUserId,
        Guid householdId,
        int limit,
        LedgerHistoryFilter filter,
        CancellationToken cancellationToken)
    {
        await using var databaseTransaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
        var transactions = dbContext.FinancialTransactions.AsNoTracking()
            .Where(item => item.HouseholdId == householdId);
        if (filter.From is not null)
            transactions = transactions.Where(item => item.OccurredOn >= filter.From.Value);
        if (filter.To is not null)
            transactions = transactions.Where(item => item.OccurredOn <= filter.To.Value);
        if (filter.Kind is not null)
            transactions = transactions.Where(item => item.Kind == filter.Kind.Value);
        if (filter.IncomeSourceId is not null)
            transactions = transactions.Where(item => item.IncomeSourceId == filter.IncomeSourceId.Value);
        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var search = filter.Search.Trim();
            transactions = transactions.Where(item =>
                item.Description != null && EF.Functions.ILike(item.Description, $"%{search}%"));
        }

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
            .Skip(Math.Max(0, filter.Offset))
            .Take(limit)
            .ToListAsync(cancellationToken);
        await databaseTransaction.CommitAsync(cancellationToken);
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
        Guid actorUserId, Guid householdId, int limit, CancellationToken cancellationToken) =>
        GetHistoryAsync(actorUserId, householdId, limit, new LedgerHistoryFilter(), cancellationToken);

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

    public async Task<LedgerHistoryItem> CorrectClassificationAsync(
        Guid householdId,
        Guid transactionId,
        Guid actorUserId,
        Guid? categoryId,
        Guid? incomeSourceId,
        string? description,
        CancellationToken cancellationToken)
    {
        await using var databaseTransaction = await dbContext.BeginUserTransactionAsync(
            actorUserId, cancellationToken);

        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"select id from public.transactions where household_id = {householdId} and id = {transactionId} for update",
            cancellationToken);

        var transactionRecord = await dbContext.FinancialTransactions
            .Include(record => record.Entries)
            .FirstOrDefaultAsync(
                record => record.HouseholdId == householdId && record.Id == transactionId,
                cancellationToken);

        if (transactionRecord is null)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.TransactionNotFound,
                "Transaction was not found.");
        }

        CategoryRecord? categoryRecord = null;
        if (categoryId is not null)
        {
            categoryRecord = await dbContext.Categories
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    cat => cat.HouseholdId == householdId && cat.Id == categoryId.Value,
                    cancellationToken);

            if (categoryRecord is null)
            {
                throw new FinancialRuleException(
                    FinancialErrorCodes.InvalidCategory,
                    "Category must belong to the household.");
            }
        }

        IncomeSourceRecord? sourceRecord = null;
        if (incomeSourceId is not null)
        {
            sourceRecord = await dbContext.IncomeSources
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    src => src.HouseholdId == householdId && src.Id == incomeSourceId.Value,
                    cancellationToken);

            if (sourceRecord is null)
            {
                throw new FinancialRuleException(
                    FinancialErrorCodes.InvalidIncomeSource,
                    "Income source must belong to the household.");
            }
        }

        var domainTransaction = ToDomain(transactionRecord);
        var categoryDomain = categoryRecord is null ? null : ToDomain(categoryRecord);
        var sourceDomain = sourceRecord is null ? null : ToDomain(sourceRecord);

        var correctedDomain = domainTransaction.CorrectClassification(
            categoryDomain,
            sourceDomain,
            description);

        transactionRecord.Description = correctedDomain.Description;
        transactionRecord.IncomeSourceId = correctedDomain.IncomeSourceId;

        foreach (var entryRecord in transactionRecord.Entries)
        {
            var matchingDomainEntry = correctedDomain.Entries.FirstOrDefault(e => e.Id == entryRecord.Id);
            entryRecord.CategoryId = matchingDomainEntry?.CategoryId ?? (correctedDomain.Entries.Count > 0 ? correctedDomain.Entries[0].CategoryId : null);
        }

        AddAudit(
            householdId,
            actorUserId,
            "TransactionClassificationCorrected",
            PersistenceVocabulary.EntityTypes.Transaction,
            transactionId);

        await dbContext.SaveChangesAsync(cancellationToken);
        await databaseTransaction.CommitAsync(cancellationToken);

        var historyList = await GetHistoryAsync(
            actorUserId,
            householdId,
            200,
            new LedgerHistoryFilter(),
            cancellationToken);

        var historyItem = historyList.FirstOrDefault(item => item.TransactionId == transactionId);
        if (historyItem is null)
        {
            throw new InvalidOperationException("Failed to retrieve updated transaction history item.");
        }

        return historyItem;
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
