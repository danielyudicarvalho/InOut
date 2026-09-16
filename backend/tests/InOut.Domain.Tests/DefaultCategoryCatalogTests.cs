using InOut.Domain.Financial;
using Xunit;

namespace InOut.Domain.Tests;

public sealed class DefaultCategoryCatalogTests
{
    [Fact]
    public void CatalogDefinesEveryDefaultCategoryKindOnce()
    {
        var definitions = DefaultCategoryCatalog.All;

        Assert.Equal(Enum.GetValues<DefaultCategoryKind>().Length, definitions.Count);
        Assert.Equal(definitions.Count, definitions.Select(item => item.Kind).Distinct().Count());
        Assert.All(definitions, item => Assert.False(string.IsNullOrWhiteSpace(item.Name)));
    }

    [Fact]
    public void CatalogContainsIncomeAndExpenseCategories()
    {
        var flows = DefaultCategoryCatalog.All.Select(item => item.Flow).Distinct();

        Assert.Contains(FinancialFlow.Income, flows);
        Assert.Contains(FinancialFlow.Expense, flows);
    }
}
