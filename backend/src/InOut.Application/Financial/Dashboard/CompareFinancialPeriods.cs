using InOut.Application.Security;
using InOut.Domain.Financial;
using InOut.Domain.Households;

namespace InOut.Application.Financial.Dashboard;

public sealed record CompareFinancialPeriodsQuery(
    Guid ActorUserId,
    Guid HouseholdId,
    int? Year = null,
    int? Month = null,
    DateOnly? From = null,
    DateOnly? To = null);

public sealed class CompareFinancialPeriods(
    IHouseholdMembershipReader membershipReader,
    IDashboardReader dashboardReader)
{
    public async Task<FinancialPeriodComparison> ExecuteAsync(
        CompareFinancialPeriodsQuery query,
        CancellationToken cancellationToken)
    {
        if (!await membershipReader.IsMemberAsync(
                query.ActorUserId,
                query.HouseholdId,
                cancellationToken))
        {
            throw new HouseholdRuleException(
                HouseholdErrorCodes.MembershipRequired,
                "The user is not a member of this household.");
        }

        FinancialPeriod currentPeriod;
        if (query.From is not null && query.To is not null)
        {
            currentPeriod = FinancialPeriod.Custom(query.From.Value, query.To.Value);
        }
        else if (query.Year is not null && query.Month is not null)
        {
            currentPeriod = FinancialPeriod.Monthly(query.Year.Value, query.Month.Value);
        }
        else
        {
            var now = DateTime.UtcNow;
            currentPeriod = FinancialPeriod.Monthly(now.Year, now.Month);
        }

        var previousPeriod = currentPeriod.GetPreviousPeriod();

        var currentSource = await dashboardReader.ReadAsync(
            query.ActorUserId,
            query.HouseholdId,
            currentPeriod,
            cancellationToken);

        var previousSource = await dashboardReader.ReadAsync(
            query.ActorUserId,
            query.HouseholdId,
            previousPeriod,
            cancellationToken);

        var currentTotals = FinancialDashboardCalculator.Calculate(
            currentSource.Accounts.Select(a => new DashboardAccountSnapshot(a.Id, a.Currency, a.BalanceCents)).ToArray(),
            currentSource.Postings);

        var previousTotals = FinancialDashboardCalculator.Calculate(
            previousSource.Accounts.Select(a => new DashboardAccountSnapshot(a.Id, a.Currency, a.BalanceCents)).ToArray(),
            previousSource.Postings);

        return FinancialPeriodComparator.Compare(
            currentPeriod,
            previousPeriod,
            currentTotals,
            previousTotals);
    }
}
