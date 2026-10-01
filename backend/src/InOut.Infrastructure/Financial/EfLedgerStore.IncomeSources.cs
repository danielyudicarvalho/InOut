using InOut.Application.Financial;
using InOut.Domain.Financial;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace InOut.Infrastructure.Financial;

public sealed partial class EfLedgerStore
{
    public async Task<IReadOnlyList<IncomeSourceSummary>> GetIncomeSourcesAsync(
        Guid actorUserId, Guid householdId, bool includeArchived, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
        var query = dbContext.IncomeSources.AsNoTracking().Where(source => source.HouseholdId == householdId);
        if (!includeArchived) query = query.Where(source => source.ArchivedAt == null);
        var result = await query.OrderBy(source => source.Name)
            .Select(source => new IncomeSourceSummary(source.Id, source.Name, source.ArchivedAt))
            .ToArrayAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return result;
    }

    public async Task<IncomeSourceSummary> CreateIncomeSourceAsync(
        IncomeSource source, Guid actorUserId, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
        var exists = await dbContext.IncomeSources.AnyAsync(
            item => item.HouseholdId == source.HouseholdId
                    && item.ArchivedAt == null
                    && EF.Functions.ILike(item.Name, source.Name),
            cancellationToken);
        if (exists)
            throw new FinancialRuleException(FinancialErrorCodes.IncomeSourceConflict, "Income source already exists.");

        dbContext.IncomeSources.Add(new IncomeSourceRecord
        {
            Id = source.Id,
            HouseholdId = source.HouseholdId,
            Name = source.Name,
            CreatedBy = actorUserId,
        });
        AddAudit(source.HouseholdId, actorUserId, PersistenceVocabulary.AuditActions.IncomeSourceCreated, PersistenceVocabulary.EntityTypes.IncomeSource, source.Id);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException error) when (error.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new FinancialRuleException(FinancialErrorCodes.IncomeSourceConflict, "Income source already exists.");
        }
        return new IncomeSourceSummary(source.Id, source.Name, null);
    }

    public async Task ArchiveIncomeSourceAsync(
        Guid householdId, Guid sourceId, Guid actorUserId, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
        var source = await dbContext.IncomeSources.SingleOrDefaultAsync(
            row => row.HouseholdId == householdId && row.Id == sourceId, cancellationToken);
        if (source is null)
            throw new FinancialRuleException(FinancialErrorCodes.IncomeSourceNotFound, "Income source was not found.");
        if (source.ArchivedAt is null)
        {
            source.ArchivedAt = new IncomeSource(source.Id, source.HouseholdId, source.Name, null)
                .Archive(timeProvider.GetUtcNow()).ArchivedAt;
            AddAudit(householdId, actorUserId, PersistenceVocabulary.AuditActions.IncomeSourceArchived, PersistenceVocabulary.EntityTypes.IncomeSource, sourceId);
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken);
    }
}
