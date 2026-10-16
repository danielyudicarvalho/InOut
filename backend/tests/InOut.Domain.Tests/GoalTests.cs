using InOut.Domain.Financial;
using Xunit;

namespace InOut.Domain.Tests;

public sealed class GoalTests
{
    [Fact]
    public void GoalAutoCompletesWhenAllocatedMeetsOrExceedsTarget()
    {
        var goalId = Guid.NewGuid();
        var householdId = Guid.NewGuid();
        var actorId = Guid.NewGuid();

        var goal = Goal.Create(
            goalId,
            householdId,
            "Reserva de Emergência",
            100_000,
            50_000,
            new DateOnly(2026, 12, 31),
            actorId);

        Assert.Equal(GoalStatus.Active, goal.Status);
        Assert.True(goal.CanAllocate);

        var completed = goal.UpdateAllocated(100_000);
        Assert.Equal(GoalStatus.Completed, completed.Status);
    }

    [Fact]
    public void PausingGoalPreventsAllocationUntilResumed()
    {
        var goal = Goal.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Viagem",
            200_000,
            0,
            null,
            Guid.NewGuid());

        var paused = goal.Pause();
        Assert.Equal(GoalStatus.Paused, paused.Status);
        Assert.False(paused.CanAllocate);

        var ex = Assert.Throws<FinancialRuleException>(() => paused.UpdateAllocated(10_000));
        Assert.Equal(FinancialErrorCodes.InvalidGoalName, ex.Code);

        var resumed = paused.Resume();
        Assert.Equal(GoalStatus.Active, resumed.Status);
        Assert.True(resumed.CanAllocate);

        var updated = resumed.UpdateAllocated(10_000);
        Assert.Equal(10_000, updated.AllocatedCents);
    }

    [Fact]
    public void ArchivedGoalRejectsAllocation()
    {
        var goal = Goal.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Carro",
            500_000,
            100_000,
            null,
            Guid.NewGuid()).Archive(DateTimeOffset.UtcNow);

        Assert.Equal(GoalStatus.Archived, goal.Status);
        Assert.False(goal.CanAllocate);

        var ex = Assert.Throws<FinancialRuleException>(() => goal.UpdateAllocated(200_000));
        Assert.Equal(FinancialErrorCodes.InvalidGoalName, ex.Code);
    }
}
