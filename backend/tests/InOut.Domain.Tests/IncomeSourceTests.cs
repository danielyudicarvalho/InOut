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
}
