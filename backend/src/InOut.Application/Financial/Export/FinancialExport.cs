using InOut.Application.Security;
using InOut.Domain.Financial;
using InOut.Domain.Households;

namespace InOut.Application.Financial.Export;

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
