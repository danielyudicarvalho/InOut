using InOut.Application.Security;
using InOut.Domain.Financial;
using InOut.Domain.Households;

namespace InOut.Application.Financial.Dashboard;

public sealed record AnalysisFacts(long IncomeCents, long ExpenseCents, long ResultCents);
public sealed record AnalysisChange(string Kind, Guid? Id, string Name, long CurrentCents, long PreviousCents, long DeltaCents, double? PercentageChange);
public sealed record AnalysisPoint(DateOnly From, DateOnly To, long IncomeCents, long ExpenseCents, long ResultCents);
public sealed record AnalysisAccount(Guid Id, string Name, long IncomeCents, long ExpenseCents, long TransferInCents, long TransferOutCents, long InflowCents, long OutflowCents, long ChangeCents);
public sealed record FinancialAnalysis(DateOnly From, DateOnly To, DateOnly PreviousFrom, DateOnly PreviousTo,
    string Currency, bool IsReconciled, AnalysisFacts Current, AnalysisFacts Previous,
    IReadOnlyList<AnalysisChange> Changes, IReadOnlyList<AnalysisPoint> Series, IReadOnlyList<AnalysisAccount> Accounts);

public sealed class GetFinancialAnalysis(IHouseholdMembershipReader membership, IDashboardReader reader)
{
    public async Task<FinancialAnalysis> ExecuteAsync(Guid actor, Guid household, string currency, DateOnly from, DateOnly to, CancellationToken ct)
    {
        if (!await membership.IsMemberAsync(actor, household, ct))
            throw new HouseholdRuleException(HouseholdErrorCodes.MembershipRequired, "Membership required.");
        if (currency.Length != 3 || currency.Any(c => c is < 'A' or > 'Z') || from.Year < 2000 || to.Year > 9998 || to.DayNumber - from.DayNumber > 730)
            throw new FinancialRuleException(FinancialErrorCodes.InvalidPeriod, "Choose a currency and a period of at most 731 days.");
        var period = FinancialPeriod.Custom(from, to);
        var monthly = from.Day == 1 && to == from.AddMonths(1).AddDays(-1);
        var previous = monthly
            ? FinancialPeriod.Custom(from.AddMonths(-1), from.AddDays(-1))
            : period.GetPreviousPeriod();
        var seriesFrom = monthly ? from.AddMonths(-5) : from;
        var readFrom = seriesFrom < previous.Start ? seriesFrom : previous.Start;
        var source = await reader.ReadIncomeHistoryAsync(actor, household, FinancialPeriod.Custom(readFrom, to), ct);
        var accounts = source.Accounts.Where(a => a.Currency == currency).ToArray();
        var ids = accounts.Select(a => a.Id).ToHashSet();
        var all = source.Postings.Where(p => ids.Contains(p.AccountId)).ToArray();
        DashboardPosting[] Rows(DateOnly start, DateOnly end) => all.Where(p => p.OccurredOn >= start && p.OccurredOn <= end).ToArray();
        FinancialDashboardTotals Totals(DashboardPosting[] rows) => FinancialDashboardCalculator.Calculate(
            accounts.Select(a => new DashboardAccountSnapshot(a.Id, a.Currency, a.BalanceCents)).ToArray(), rows);
        AnalysisFacts Facts(FinancialDashboardTotals totals)
        {
            var c = totals.Currencies.SingleOrDefault();
            return new(c?.IncomeCents ?? 0, c?.ExpenseCents ?? 0, c?.ResultCents ?? 0);
        }
        var currentRows = Rows(from, to);
        var current = Totals(currentRows);
        var prior = Totals(Rows(previous.Start, previous.End));
        var changes = new List<AnalysisChange>();
        void Change(string kind, Guid? id, string name, long now, long before) => changes.Add(
            new(kind, id, name, now, before, now - before, before == 0 ? (now == 0 ? 0 : null) : Math.Round((double)(now - before) / Math.Abs(before) * 100, 2)));
        var nowFacts = Facts(current); var beforeFacts = Facts(prior);
        Change("income", null, "Receitas", nowFacts.IncomeCents, beforeFacts.IncomeCents);
        Change("expense", null, "Despesas", nowFacts.ExpenseCents, beforeFacts.ExpenseCents);
        Change("result", null, "Resultado", nowFacts.ResultCents, beforeFacts.ResultCents);
        foreach (var id in current.Categories.Select(c => c.CategoryId).Union(prior.Categories.Select(c => c.CategoryId)))
            Change("category", id, source.Categories.FirstOrDefault(c => c.Id == id)?.Name ?? "Sem categoria",
                current.Categories.Where(c => c.CategoryId == id).Sum(c => c.AmountCents), prior.Categories.Where(c => c.CategoryId == id).Sum(c => c.AmountCents));
        foreach (var id in current.IncomeSources.Select(c => c.IncomeSourceId).Union(prior.IncomeSources.Select(c => c.IncomeSourceId)))
            Change("source", id, source.IncomeSources.FirstOrDefault(c => c.Id == id)?.Name ?? "Sem fonte definida",
                current.IncomeSources.Where(c => c.IncomeSourceId == id).Sum(c => c.AmountCents), prior.IncomeSources.Where(c => c.IncomeSourceId == id).Sum(c => c.AmountCents));
        var series = new List<AnalysisPoint>();
        for (var start = seriesFrom; start <= to;)
        {
            var next = new DateOnly(start.Year, start.Month, 1).AddMonths(1);
            var end = next.AddDays(-1) < to ? next.AddDays(-1) : to;
            var facts = Facts(Totals(Rows(start, end)));
            series.Add(new(start, end, facts.IncomeCents, facts.ExpenseCents, facts.ResultCents));
            if (end == to) break;
            start = next;
        }
        var movements = accounts.Select(a =>
        {
            var rows = currentRows.Where(p => p.AccountId == a.Id).ToArray();
            var income = rows.Sum(p => FinancialDashboardCalculator.IncomeContribution(p) ?? 0);
            var expense = rows.Sum(p => FinancialDashboardCalculator.ExpenseContribution(p) ?? 0);
            var transfers = rows.Where(p => p.Kind == FinancialTransactionKind.Transfer || (p.Kind == FinancialTransactionKind.Reversal && p.ReversedKind == FinancialTransactionKind.Transfer)).ToArray();
            var transferIn = transfers.Where(p => p.Direction == EntryDirection.Credit).Sum(p => p.AmountCents);
            var transferOut = transfers.Where(p => p.Direction == EntryDirection.Debit).Sum(p => p.AmountCents);
            var inflow = rows.Where(p => p.Direction == EntryDirection.Credit).Sum(p => p.AmountCents);
            var outflow = rows.Where(p => p.Direction == EntryDirection.Debit).Sum(p => p.AmountCents);
            return new AnalysisAccount(a.Id, a.Name, income, expense, transferIn, transferOut, inflow, outflow, inflow - outflow);
        }).ToArray();
        return new(from, to, previous.Start, previous.End, currency, source.PostedTransactionCount == source.EntryTransactionCount,
            nowFacts, beforeFacts, changes, series, movements);
    }
}
