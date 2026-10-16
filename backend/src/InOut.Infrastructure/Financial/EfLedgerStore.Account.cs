using System.Net;
using InOut.Application.Financial;
using InOut.Application.Idempotency;
using InOut.Domain.Financial;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InOut.Infrastructure.Financial;

public sealed partial class EfLedgerStore
{
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
        Guid actorUserId,
        Guid householdId,
        bool includeArchived,
        CancellationToken cancellationToken)
    {
        await using var databaseTransaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
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
        await databaseTransaction.CommitAsync(cancellationToken);
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

    public async Task<AccountSummary> UpdateAccountMetadataAsync(
        Guid householdId,
        Guid accountId,
        Guid actorUserId,
        string name,
        AccountKind kind,
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

        var domain = new Account(
            account.Id,
            account.HouseholdId,
            account.Name,
            account.Kind,
            account.Currency,
            account.ArchivedAt);

        var updatedDomain = domain.UpdateMetadata(name, kind);

        var duplicateExists = await dbContext.Accounts.AnyAsync(
            item => item.HouseholdId == householdId &&
                    item.Id != accountId &&
                    item.ArchivedAt == null &&
                    EF.Functions.ILike(item.Name, updatedDomain.Name),
            cancellationToken);
        if (duplicateExists)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.AccountNameConflict,
                "An active account with this name already exists in the household.");
        }

        account.Name = updatedDomain.Name;
        account.Kind = updatedDomain.Kind;

        AddAudit(
            householdId,
            actorUserId,
            PersistenceVocabulary.AuditActions.AccountMetadataUpdated,
            PersistenceVocabulary.EntityTypes.Account,
            accountId);

        await dbContext.SaveChangesAsync(cancellationToken);

        var balanceCents = await dbContext.Entries
            .Where(entry => entry.HouseholdId == householdId && entry.AccountId == accountId)
            .SumAsync(entry => (long?)(entry.Direction == EntryDirection.Credit ? entry.AmountCents : -entry.AmountCents), cancellationToken) ?? 0;

        await databaseTransaction.CommitAsync(cancellationToken);

        return new AccountSummary(
            account.Id,
            account.Name,
            account.Kind,
            account.Currency,
            balanceCents,
            account.ArchivedAt);
    }

    private static Account ToDomain(AccountRecord record) => new(
        record.Id,
        record.HouseholdId,
        record.Name,
        record.Kind,
        record.Currency,
        record.ArchivedAt);
}
