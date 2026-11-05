using InOut.Domain.Utils;

namespace InOut.Domain.Financial;

public sealed record ProjectLine(Guid Id, string Name, FinancialFlow Flow, long AmountCents);

public sealed record FinancialProject(
    Guid Id, Guid HouseholdId, string Name, string Currency, long PlannedCents,
    DateOnly StartsOn, DateOnly? EndsOn, string? Notes,
    FinancialProjectStatus Status, IReadOnlyList<ProjectLine> Lines)
{
    public string Currency { get; } = new Money(0, Currency).Currency;
    public bool IsOpen => Status == FinancialProjectStatus.Active;

    public static FinancialProject Create(
        Guid id, Guid householdId, string? name, string currency, long plannedCents,
        DateOnly startsOn, DateOnly? endsOn, string? notes, IReadOnlyList<ProjectLine> lines) =>
        new FinancialProject(
            id, householdId, NormalizeName(name), new Money(0, currency).Currency, RequireAmount(plannedCents),
            startsOn, RequireDates(startsOn, endsOn), NormalizeNotes(notes),
            FinancialProjectStatus.Active, NormalizeLines(lines));

    public FinancialProject Update(
        string? name, long plannedCents, DateOnly startsOn, DateOnly? endsOn,
        string? notes, IReadOnlyList<ProjectLine> lines)
    {
        EnsureOpen();
        return this with
        {
            Name = NormalizeName(name),
            PlannedCents = RequireAmount(plannedCents),
            StartsOn = startsOn,
            EndsOn = RequireDates(startsOn, endsOn),
            Notes = NormalizeNotes(notes),
            Lines = NormalizeLines(lines),
        };
    }

    public FinancialProject Close()
    {
        EnsureOpen();
        return this with { Status = FinancialProjectStatus.Closed };
    }

    public void EnsureOpen()
    {
        if (!IsOpen)
            throw new FinancialRuleException(FinancialErrorCodes.ProjectClosed,
                "A closed project cannot change.");
    }

    private static string NormalizeName(string? name)
    {
        var normalized = StringUtils.TrimToNull(name);
        if (string.IsNullOrEmpty(normalized) || normalized.Length > 120)
            throw new FinancialRuleException(FinancialErrorCodes.InvalidProject,
                "Project name must contain between 1 and 120 characters.");
        return normalized;
    }

    private static string? NormalizeNotes(string? notes)
    {
        var normalized = StringUtils.TrimToNull(notes);
        if (normalized is { Length: > 500 })
            throw new FinancialRuleException(FinancialErrorCodes.InvalidProject,
                "Project notes must contain at most 500 characters.");
        return normalized;
    }

    private static long RequireAmount(long cents)
    {
        if (cents <= 0)
            throw new FinancialRuleException(FinancialErrorCodes.InvalidAmount,
                "Project amount must be positive.");
        return cents;
    }

    private static DateOnly? RequireDates(DateOnly startsOn, DateOnly? endsOn)
    {
        if (endsOn is not null && endsOn < startsOn)
            throw new FinancialRuleException(FinancialErrorCodes.InvalidPeriod,
                "Project end cannot be before its start.");
        return endsOn;
    }

    private static List<ProjectLine> NormalizeLines(IReadOnlyList<ProjectLine> lines)
    {
        var seen = new HashSet<Guid>();
        var normalized = new List<ProjectLine>(lines.Count);
        foreach (var line in lines)
        {
            var name = StringUtils.TrimToNull(line.Name);
            if (line.Id == Guid.Empty || !seen.Add(line.Id) ||
                string.IsNullOrEmpty(name) || name.Length > 80 ||
                !Enum.IsDefined(line.Flow) || line.AmountCents <= 0)
                throw new FinancialRuleException(FinancialErrorCodes.InvalidProject,
                    "Each project line needs its own name, flow, and positive amount.");
            normalized.Add(line with { Name = name });
        }
        return normalized;
    }
}

public sealed record ProjectComparison(
    long PlannedIncomeCents, long PlannedExpenseCents,
    long ActualIncomeCents, long ActualExpenseCents)
{
    public long PlannedResultCents => PlannedIncomeCents - PlannedExpenseCents;
    public long ActualResultCents => ActualIncomeCents - ActualExpenseCents;

    public static ProjectComparison From(
        FinancialProject project,
        IEnumerable<DashboardPosting> linked,
        IReadOnlyDictionary<Guid, string> accountCurrencies)
    {
        var plannedIncome = project.Lines.Where(line => line.Flow == FinancialFlow.Income).Sum(line => line.AmountCents);
        var plannedExpense = project.Lines.Where(line => line.Flow == FinancialFlow.Expense).Sum(line => line.AmountCents);
        if (project.Lines.Count == 0)
            plannedExpense = project.PlannedCents;
        long actualIncome = 0;
        long actualExpense = 0;
        foreach (var posting in linked)
        {
            if (!accountCurrencies.TryGetValue(posting.AccountId, out var currency) || currency != project.Currency)
                continue;
            if (FinancialDashboardCalculator.IncomeContribution(posting) is { } income)
                actualIncome = checked(actualIncome + income);
            if (FinancialDashboardCalculator.ExpenseContribution(posting) is { } expense)
                actualExpense = checked(actualExpense + expense);
        }
        return new ProjectComparison(plannedIncome, plannedExpense, actualIncome, actualExpense);
    }
}
