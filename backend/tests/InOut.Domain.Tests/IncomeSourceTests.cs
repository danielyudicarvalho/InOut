using InOut.Domain.Financial;
using Xunit;

namespace InOut.Domain.Tests;

public sealed class IncomeSourceTests
{
    [Fact]
    public void SourceAndIncomeKeepDistinctIdentitiesThroughReversal()
    {
        var householdId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var source = IncomeSource.Create(Guid.NewGuid(), householdId, "  Employer A  ");
        var income = FinancialTransaction.Income(householdId, Guid.NewGuid(), Guid.NewGuid(),
            Money.Positive(10000), new DateOnly(2026, 9, 24), actorId, null, source.Id);
        var reversal = FinancialTransaction.Reversal(income, actorId, new DateOnly(2026, 9, 24));

        Assert.Equal("Employer A", source.Name);
        Assert.Equal(source.Id, income.IncomeSourceId);
        Assert.Null(reversal.IncomeSourceId);
        Assert.Equal(income.Id, reversal.ReversalOf);
        Assert.Equal(source.Id, source.Archive(DateTimeOffset.UtcNow).Id);
    }

    [Fact]
    public void SourceRejectsBlankName()
    {
        var exception = Assert.Throws<FinancialRuleException>(() =>
            IncomeSource.Create(Guid.NewGuid(), Guid.NewGuid(), "   "));
        Assert.Equal(FinancialErrorCodes.InvalidIncomeSource, exception.Code);
    }

    [Fact]
    public void ArchivedIncomeSourceRejectsAssignment()
    {
        var source = IncomeSource.Create(Guid.NewGuid(), Guid.NewGuid(), "Consulting")
            .Archive(DateTimeOffset.UtcNow);

        Assert.Equal(IncomeSourceStatus.Archived, source.Status);
        Assert.False(source.CanAssignTransaction);

        var ex = Assert.Throws<FinancialRuleException>(() => source.EnsureCanAssignTransaction());
        Assert.Equal(FinancialErrorCodes.InvalidIncomeSource, ex.Code);
    }

    [Fact]
    public void EnsureBelongsToHouseholdRejectsDifferentHousehold()
    {
        var householdId = Guid.NewGuid();
        var otherHouseholdId = Guid.NewGuid();
        var source = IncomeSource.Create(Guid.NewGuid(), householdId, "Freelance");

        source.EnsureBelongsToHousehold(householdId);

        var ex = Assert.Throws<FinancialRuleException>(() => source.EnsureBelongsToHousehold(otherHouseholdId));
        Assert.Equal(FinancialErrorCodes.InvalidIncomeSource, ex.Code);
    }

    [Fact]
    public void RestoringWithArchivedAtSetsArchivedStatus()
    {
        var source = new IncomeSource(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Old Client",
            DateTimeOffset.UtcNow);

        Assert.Equal(IncomeSourceStatus.Archived, source.Status);
        Assert.False(source.IsActive);
        Assert.False(source.CanAssignTransaction);
    }

    [Fact]
    public void NameLengthBoundaryValidation()
    {
        var valid80 = new string('A', IncomeSource.MaxNameLength);
        var source = IncomeSource.Create(Guid.NewGuid(), Guid.NewGuid(), valid80);
        Assert.Equal(valid80, source.Name);

        var invalid81 = new string('A', IncomeSource.MaxNameLength + 1);
        var ex = Assert.Throws<FinancialRuleException>(() =>
            IncomeSource.Create(Guid.NewGuid(), Guid.NewGuid(), invalid81));
        Assert.Equal(FinancialErrorCodes.InvalidIncomeSource, ex.Code);
    }
}
