using InOut.Domain.Financial;
using Xunit;

namespace InOut.Domain.Tests;

public sealed class GoalTests
{
    private static readonly DateTimeOffset At = new(2026, 11, 5, 16, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly On = new(2026, 11, 5);

    [Fact]
    public void GoalRejectsAllocationInAnotherCurrencyAndPreservesCurrencyThroughLifecycle()
    {
        var goal = Goal.Create(Guid.NewGuid(), Guid.NewGuid(), "Travel", 1000, null, Guid.NewGuid(), " usd ");
        Assert.Equal("USD", goal.Currency);
        var error = Assert.Throws<FinancialRuleException>(() => Allocate(goal, 500, "BRL"));
        Assert.Equal(FinancialErrorCodes.CurrencyMismatch, error.Code);
        var allocated = Allocate(goal, 500, "usd");
        Assert.Equal("USD", allocated.Goal.Pause().Resume().Archive(At).Currency);
        Assert.Equal(500, allocated.Goal.AllocatedCents);
        Assert.Equal(GoalAllocationKind.Contribution, allocated.Allocation.Kind);
        Assert.Equal(GoalAllocationOrigin.Recorded, allocated.Allocation.Origin);
    }

    [Theory]
    [InlineData("")]
    [InlineData("US")]
    [InlineData("123")]
    public void GoalRejectsMissingOrMalformedCurrency(string currency)
    {
        var error = Assert.Throws<FinancialRuleException>(() => Goal.Create(Guid.NewGuid(), Guid.NewGuid(),
            "Travel", 1000, null, Guid.NewGuid(), currency));
        Assert.Equal(FinancialErrorCodes.InvalidCurrency, error.Code);
    }

    [Fact]
    public void GoalAutoCompletesWhenAllocatedMeetsOrExceedsTarget()
    {
        var goal = Goal.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Reserva de Emergência",
            100_000,
            new DateOnly(2026, 12, 31),
            Guid.NewGuid(),
            "BRL");

        Assert.Equal(GoalStatus.Active, goal.Status);
        Assert.True(goal.CanAllocate);
        Assert.Equal(0, goal.AllocatedCents);

        var completed = Allocate(goal, 100_000, "BRL");
        Assert.Equal(GoalStatus.Completed, completed.Goal.Status);
        Assert.Equal(100_000, completed.Goal.AllocatedCents);
    }

    [Fact]
    public void PausingGoalPreventsAllocationUntilResumed()
    {
        var goal = Goal.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Viagem",
            200_000,
            null,
            Guid.NewGuid(),
            "BRL");

        var paused = goal.Pause();
        Assert.Equal(GoalStatus.Paused, paused.Status);
        Assert.False(paused.CanAllocate);

        var ex = Assert.Throws<FinancialRuleException>(() => Allocate(paused, 10_000, "BRL"));
        Assert.Equal(FinancialErrorCodes.InvalidGoalName, ex.Code);

        var resumed = paused.Resume();
        Assert.Equal(GoalStatus.Active, resumed.Status);
        Assert.True(resumed.CanAllocate);

        var updated = Allocate(resumed, 10_000, "BRL");
        Assert.Equal(10_000, updated.Goal.AllocatedCents);
    }

    [Fact]
    public void ArchivedGoalRejectsAllocationAndReversal()
    {
        var actor = Guid.NewGuid();
        var goal = Goal.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Carro",
            500_000,
            null,
            actor,
            "BRL");
        var progressed = Allocate(goal, 100_000, "BRL");
        var archived = progressed.Goal.Archive(At);

        Assert.Equal(GoalStatus.Archived, archived.Status);
        Assert.False(archived.CanAllocate);

        var allocate = Assert.Throws<FinancialRuleException>(() =>
            Allocate(archived, 200_000, "BRL", [progressed.Allocation]));
        Assert.Equal(FinancialErrorCodes.InvalidGoalName, allocate.Code);
        var reverse = Assert.Throws<FinancialRuleException>(() => archived.ReverseAllocation(
            [progressed.Allocation], Guid.NewGuid(), progressed.Allocation.Id, On, actor, null, At));
        Assert.Equal(FinancialErrorCodes.InvalidGoalName, reverse.Code);
    }

    [Fact]
    public void AllocationHistoryExplainsProgressAndReversalKeepsTheOriginal()
    {
        var actor = Guid.NewGuid();
        var goal = Goal.Create(Guid.NewGuid(), Guid.NewGuid(), "Reserva", 10_000, null, actor, "BRL");
        var first = Allocate(goal, 4_000, "BRL");
        var second = Allocate(first.Goal, 6_000, "BRL", [first.Allocation]);
        Assert.Equal(GoalStatus.Completed, second.Goal.Status);
        Assert.False(second.Goal.CanAllocate);
        var extra = Assert.Throws<FinancialRuleException>(() =>
            Allocate(second.Goal, 1, "BRL", [first.Allocation, second.Allocation]));
        Assert.Equal(FinancialErrorCodes.InvalidGoalName, extra.Code);

        var reversed = second.Goal.ReverseAllocation(
            [first.Allocation, second.Allocation],
            Guid.NewGuid(),
            first.Allocation.Id,
            On,
            actor,
            " valor separado por engano ",
            At);

        Assert.Equal(6_000, reversed.Goal.AllocatedCents);
        Assert.Equal(GoalStatus.Active, reversed.Goal.Status);
        Assert.Equal(first.Allocation.Id, reversed.Allocation.ReversalOf);
        Assert.Equal(4_000, reversed.Allocation.AmountCents);
        Assert.Equal("BRL", reversed.Allocation.Currency);
        Assert.Equal("valor separado por engano", reversed.Allocation.Note);
        Assert.Equal(GoalAllocationKind.Contribution, first.Allocation.Kind);

        var again = Assert.Throws<FinancialRuleException>(() => reversed.Goal.ReverseAllocation(
            [first.Allocation, second.Allocation, reversed.Allocation],
            Guid.NewGuid(),
            first.Allocation.Id,
            On,
            actor,
            null,
            At));
        Assert.Equal(FinancialErrorCodes.GoalAllocationNotReversible, again.Code);
        var reversalOfReversal = Assert.Throws<FinancialRuleException>(() => reversed.Goal.ReverseAllocation(
            [first.Allocation, second.Allocation, reversed.Allocation],
            Guid.NewGuid(),
            reversed.Allocation.Id,
            On,
            actor,
            null,
            At));
        Assert.Equal(FinancialErrorCodes.ReversalOfReversal, reversalOfReversal.Code);
    }

    [Fact]
    public void PausedGoalCanReverseAnAllocationWithoutAcceptingANewOne()
    {
        var actor = Guid.NewGuid();
        var goal = Goal.Create(Guid.NewGuid(), Guid.NewGuid(), "Viagem", 10_000, null, actor, "BRL");
        var allocated = Allocate(goal, 2_500, "BRL");
        var paused = allocated.Goal.Pause();

        var reversed = paused.ReverseAllocation(
            [allocated.Allocation], Guid.NewGuid(), allocated.Allocation.Id, On, actor, null, At);

        Assert.Equal(GoalStatus.Paused, reversed.Goal.Status);
        Assert.Equal(0, reversed.Goal.AllocatedCents);
        Assert.False(reversed.Goal.CanAllocate);
    }

    [Fact]
    public void OpeningBalanceCountsAsHistoryAndCanBeReversed()
    {
        var actor = Guid.NewGuid();
        var goal = Goal.Restore(
            Guid.NewGuid(), Guid.NewGuid(), "Casa", 1_000, 100, null, actor, At, null, "USD", GoalStatus.Active);
        var opening = GoalAllocation.Restore(
            Guid.NewGuid(), goal.HouseholdId, goal.Id, 100, "USD",
            GoalAllocationKind.Contribution, GoalAllocationOrigin.Opening, null, On, null, actor, At);

        var unexplained = Assert.Throws<FinancialRuleException>(() => Allocate(goal, 50, "USD"));
        Assert.Equal(FinancialErrorCodes.GoalProgressUnexplained, unexplained.Code);

        var reversed = goal.ReverseAllocation(
            [opening], Guid.NewGuid(), opening.Id, On, actor, null, At);
        Assert.Equal(0, reversed.Goal.AllocatedCents);
        Assert.Equal(opening.Id, reversed.Allocation.ReversalOf);
    }

    [Fact]
    public void MissingAllocationCannotBeReversed()
    {
        var actor = Guid.NewGuid();
        var goal = Goal.Create(Guid.NewGuid(), Guid.NewGuid(), "Casa", 1_000, null, actor, "BRL");
        var error = Assert.Throws<FinancialRuleException>(() =>
            goal.ReverseAllocation([], Guid.NewGuid(), Guid.NewGuid(), On, actor, null, At));
        Assert.Equal(FinancialErrorCodes.GoalAllocationNotFound, error.Code);
    }

    private static GoalProgress Allocate(
        Goal goal,
        long amountCents,
        string currency,
        IReadOnlyCollection<GoalAllocation>? history = null) =>
        goal.Allocate(history ?? [], Guid.NewGuid(), amountCents, currency, On, goal.CreatedBy, null, At);
}