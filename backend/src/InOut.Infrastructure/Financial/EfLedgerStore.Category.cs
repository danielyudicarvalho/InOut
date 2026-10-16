using System.Net;
using InOut.Application.Financial;
using InOut.Application.Idempotency;
using InOut.Domain.Financial;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace InOut.Infrastructure.Financial;

public sealed partial class EfLedgerStore
{
    public async Task<IReadOnlyList<CategorySummary>> GetCategoriesAsync(
        Guid actorUserId,
        Guid householdId,
        FinancialFlow? flow,
        bool includeArchived,
        CancellationToken cancellationToken)
    {
        await using var databaseTransaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
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

        var result = await query
            .OrderBy(item => item.Name)
            .Select(item => new CategorySummary(
                item.Id,
                item.Name,
                item.Flow,
                item.ParentId,
                item.ArchivedAt))
            .ToArrayAsync(cancellationToken);
        await databaseTransaction.CommitAsync(cancellationToken);
        return result;
    }

    public Task<IReadOnlyList<CategorySummary>> GetCategoriesAsync(
        Guid actorUserId, Guid householdId, FinancialFlow? flow, CancellationToken cancellationToken) =>
        GetCategoriesAsync(actorUserId, householdId, flow, false, cancellationToken);

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

        var duplicateExists = await dbContext.Categories.AnyAsync(
            item => item.HouseholdId == householdId &&
                    item.ParentId == parentId &&
                    item.ArchivedAt == null &&
                    EF.Functions.ILike(item.Name, category.Name),
            cancellationToken);
        if (duplicateExists)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.CategoryConflict,
                "An active category with this name already exists in this scope.");
        }

        dbContext.Categories.Add(new CategoryRecord
        {
            Id = category.Id,
            HouseholdId = householdId,
            ParentId = category.ParentId,
            Name = category.Name,
            Flow = category.Flow,
            Status = category.Status,
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
            record.Status = CategoryStatus.Archived;
            AddAudit(householdId, actorUserId, PersistenceVocabulary.AuditActions.CategoryArchived,
                PersistenceVocabulary.EntityTypes.Category, categoryId);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        await databaseTransaction.CommitAsync(cancellationToken);
    }

    private static Category ToDomain(CategoryRecord record) => new(
        record.Id,
        record.HouseholdId,
        record.Name,
        record.Flow,
        record.ParentId,
        record.ArchivedAt,
        record.Status);
}
