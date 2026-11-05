using InOut.Domain.Financial;
using Xunit;

namespace InOut.Domain.Tests;

public sealed class PlanningTests
{
    [Fact]
    public void BudgetUsageCountsOnlyTheCategoryCurrencyAndKeepsHistorySeparate()
    {
        var food = Guid.NewGuid();
        var account = Guid.NewGuid();
        var currencies = new Dictionary<Guid, string> { [account] = "BRL" };
        var names = new Dictionary<Guid, string> { [account] = "Carteira" };
        var postings = new[]
        {
            Posting(account, food, FinancialTransactionKind.Expense, 2_000, new DateOnly(2026, 11, 2)),
            Posting(account, food, FinancialTransactionKind.Reversal, 500, new DateOnly(2026, 11, 3), FinancialTransactionKind.Expense),
            Posting(account, Guid.NewGuid(), FinancialTransactionKind.Expense, 9_000, new DateOnly(2026, 11, 4)),
        };

        Assert.Equal(1_500, BudgetUsage.Spent(postings, currencies, food, "BRL"));
        Assert.Equal(8_500, BudgetUsage.Remaining(10_000, 1_500));
        var line = Assert.Single(BudgetUsage.Expenses(postings, currencies, names, food, "BRL"), item => item.AmountCents > 0);
        Assert.Equal(2_000, line.AmountCents);
    }

    [Fact]
    public void GoalEditAndCompletionDoNotRewriteAllocatedProgress()
    {
        var goal = Goal.Create(Guid.NewGuid(), Guid.NewGuid(), "Viagem", 10_000, null, Guid.NewGuid(), "BRL");
        var edited = goal.UpdateDetails(" Viagem de inverno ", 8_000, new DateOnly(2026, 12, 1));
        Assert.Equal("Viagem de inverno", edited.Name);
        Assert.Equal(0, edited.AllocatedCents);
        Assert.Equal(GoalStatus.Active, edited.Status);
        Assert.Equal(GoalStatus.Completed, edited.Complete().Status);
        Assert.Throws<FinancialRuleException>(() => edited.Archive(DateTimeOffset.UtcNow).UpdateDetails("Outra", 8_000, null));
    }

    [Fact]
    public void ProjectComparisonUsesLinkedLedgerAmountsAndKeepsThePlan()
    {
        var line = new ProjectLine(Guid.NewGuid(), "Passagens", FinancialFlow.Expense, 30_000);
        var project = FinancialProject.Create(Guid.NewGuid(), Guid.NewGuid(), "Férias", "BRL", 30_000,
            new DateOnly(2026, 11, 1), null, null, [line]);
        var account = Guid.NewGuid();
        var comparison = ProjectComparison.From(project, [
            Posting(account, Guid.NewGuid(), FinancialTransactionKind.Expense, 12_000, new DateOnly(2026, 11, 8)),
        ], new Dictionary<Guid, string> { [account] = "BRL" });

        Assert.Equal(30_000, comparison.PlannedExpenseCents);
        Assert.Equal(12_000, comparison.ActualExpenseCents);
        Assert.Equal(FinancialProjectStatus.Closed, project.Close().Status);
        Assert.Throws<FinancialRuleException>(() => project.Close().Update("Férias", 30_000, project.StartsOn, null, null, project.Lines));
    }

    [Fact]
    public void AgendaShowsTheScheduledDateAndARealizedCopy()
    {
        var plan = RecurringPlan.Create(Guid.NewGuid(), Guid.NewGuid(), "Aluguel", FinancialFlow.Expense,
            Guid.NewGuid(), Guid.NewGuid(), null, 18_000, "BRL", 31, new DateOnly(2026, 1, 1), null);
        var occurrence = new AgendaOccurrence(Guid.NewGuid(), plan.Id, new DateOnly(2026, 2, 28),
            Guid.NewGuid(), FinancialFlow.Expense, 18_000, "BRL");
        var items = FinancialAgenda.Compose([plan], [occurrence],
            new DateOnly(2026, 2, 1), new DateOnly(2026, 3, 31), new DateOnly(2026, 4, 1));

        var february = Assert.Single(items, item => item.ScheduledOn == new DateOnly(2026, 2, 28));
        var march = Assert.Single(items, item => item.ScheduledOn == new DateOnly(2026, 3, 31));
        Assert.Equal(AgendaState.Realized, february.State);
        Assert.Equal(occurrence.TransactionId, february.TransactionId);
        Assert.Equal(AgendaState.Overdue, march.State);
        Assert.Equal(18_000, march.AmountCents);
    }

    [Fact]
    public void ForecastComparisonKeepsExpectedFiguresBesideActualMovements()
    {
        var month = new DateOnly(2026, 11, 1);
        var account = Guid.NewGuid();
        var point = new ForecastPoint(month, 5_000, 2_000, 3_000, [], []);
        var actual = ForecastComparison.Actual(month, account, [
            Posting(account, Guid.NewGuid(), FinancialTransactionKind.Income, 4_000, new DateOnly(2026, 11, 2)),
            Posting(account, Guid.NewGuid(), FinancialTransactionKind.Expense, 1_000, new DateOnly(2026, 11, 3)),
            Posting(account, Guid.NewGuid(), FinancialTransactionKind.Expense, 9_000, new DateOnly(2026, 12, 1)),
        ]);
        var compared = Assert.Single(ForecastComparison.Compare([point], [actual]));
        Assert.Equal(5_000, compared.ExpectedIncomeCents);
        Assert.Equal(4_000, compared.ActualIncomeCents);
        Assert.Equal(1_000, compared.ActualExpenseCents);
    }

    private static DashboardPosting Posting(
        Guid accountId, Guid categoryId, FinancialTransactionKind kind, long amount, DateOnly date,
        FinancialTransactionKind? reversed = null) =>
        new(accountId, categoryId, kind, reversed, amount, null, Guid.NewGuid(), Guid.NewGuid(), date, "Item", null, null);
}
