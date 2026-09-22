using InOut.Domain.Financial;

namespace InOut.Domain.Tests;

public sealed class CategoryTests
{
    [Fact]
    public void CreateRetainsNormalizedNameAndParentIdentity()
    {
        var categoryId = Guid.NewGuid();
        var householdId = Guid.NewGuid();
        var parentId = Guid.NewGuid();

        var category = Category.Create(
            categoryId,
            householdId,
            "  Restaurant  ",
            FinancialFlow.Expense,
            parentId);

        Assert.Equal("Restaurant", category.Name);
        Assert.Equal(parentId, category.ParentId);
        Assert.Equal(FinancialFlow.Expense, category.Flow);
    }

    [Fact]
    public void CreateRejectsSelfParenting()
    {
        var categoryId = Guid.NewGuid();

        var exception = Assert.Throws<FinancialRuleException>(() => Category.Create(
            categoryId,
            Guid.NewGuid(),
            "Food",
            FinancialFlow.Expense,
            categoryId));

        Assert.Equal(FinancialErrorCodes.InvalidCategory, exception.Code);
    }
}
