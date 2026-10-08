using InOut.Domain.Financial;
using Xunit;

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

    [Fact]
    public void ArchiveSetsArchivedAtForActiveCategory()
    {
        var category = Category.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Lazer",
            FinancialFlow.Expense);
        var archivedAt = new DateTimeOffset(2026, 10, 1, 12, 0, 0, TimeSpan.Zero);

        var archived = category.Archive(archivedAt);

        Assert.True(category.IsActive);
        Assert.False(archived.IsActive);
        Assert.Equal(archivedAt, archived.ArchivedAt);
    }

    [Fact]
    public void ArchiveIsNoOpForAlreadyArchivedCategory()
    {
        var archivedAt1 = new DateTimeOffset(2026, 9, 1, 12, 0, 0, TimeSpan.Zero);
        var archivedAt2 = new DateTimeOffset(2026, 10, 1, 12, 0, 0, TimeSpan.Zero);
        var category = Category.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Lazer",
            FinancialFlow.Expense).Archive(archivedAt1);

        var reArchived = category.Archive(archivedAt2);

        Assert.Equal(archivedAt1, reArchived.ArchivedAt);
    }
}
