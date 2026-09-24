using InOut.Application.Financial;
using InOut.Domain.Financial;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace InOut.Infrastructure.Financial;

public sealed partial class EfLedgerStore
{
    public async Task<IReadOnlyList<IncomeSourceSummary>> GetIncomeSourcesAsync(
        Guid householdId, bool includeArchived, CancellationToken cancellationToken)
    {
        var query = dbContext.IncomeSources.AsNoTracking().Where(source => source.HouseholdId == householdId);
        if (!includeArchived) query = query.Where(source => source.ArchivedAt == null);
        return await query.OrderBy(source => source.Name)
            .Select(source => new IncomeSourceSummary(source.Id, source.Name, source.ArchivedAt))
            .ToArrayAsync(cancellationToken);
    }

    public async Task<IncomeSourceSummary> CreateIncomeSourceAsync(
        IncomeSource source, Guid actorUserId, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
        dbContext.IncomeSources.Add(new IncomeSourceRecord
        {
            Id = source.Id, HouseholdId = source.HouseholdId,
            Name = source.Name, CreatedBy = actorUserId,
        });
        AddAudit(source.HouseholdId, actorUserId, "financial.income_source.created", "income_source", source.Id);
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
            AddAudit(householdId, actorUserId, "financial.income_source.archived", "income_source", sourceId);
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken);
    }
}
