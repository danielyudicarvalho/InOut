using InOut.Application.Security;
using InOut.Domain.Households;

namespace InOut.Application.Financial.Export;

public sealed record FinancialExportRow(
    Guid TransactionId,
    string Kind,
    string Status,
    DateOnly OccurredOn,
    DateTimeOffset CreatedAt,
    DateTimeOffset? PostedAt,
    string? Description,
    Guid? ReversalOf,
    Guid? OpeningAccountId,
    Guid? EntryId,
    Guid? AccountId,
    string? AccountName,
    string? Currency,
    Guid? CategoryId,
    string? CategoryName,
    Guid? CategoryParentId,
    string? CategoryFlow,
    string? Direction,
    long? AmountCents);

public interface IFinancialExportReader
{
    Task<IReadOnlyList<FinancialExportRow>> ReadAsync(
        Guid actorUserId,
        Guid householdId,
        CancellationToken cancellationToken);
}

public sealed class ExportFinancialData(
    IHouseholdMembershipReader membershipReader,
    IFinancialExportReader reader)
{
    public async Task<IReadOnlyList<FinancialExportRow>> ExecuteAsync(
        Guid actorUserId,
        Guid householdId,
        CancellationToken cancellationToken)
    {
        if (!await membershipReader.IsMemberAsync(actorUserId, householdId, cancellationToken))
        {
            throw new HouseholdRuleException(
                HouseholdErrorCodes.MembershipRequired,
                "The user is not a member of this household.");
        }

        return await reader.ReadAsync(actorUserId, householdId, cancellationToken);
    }
}
