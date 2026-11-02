using InOut.Domain.Financial;
using Xunit;

namespace InOut.Domain.Tests;

public sealed class TransactionClassificationSnapshotTests
{
    [Theory]
    [InlineData("status")]
    [InlineData("category")]
    [InlineData("source")]
    [InlineData("description")]
    public void StaleSnapshotRejectsCorrectionAndPreservesTheOriginal(string field)
    {
        var household = Guid.NewGuid();
        var category = Category.Create(Guid.NewGuid(), household, "Salary", FinancialFlow.Income);
        var source = IncomeSource.Create(Guid.NewGuid(), household, "Employer");
        var original = FinancialTransaction.Income(household, Guid.NewGuid(), category.Id,
            new Money(32_000), new DateOnly(2026, 11, 2), Guid.NewGuid(), "Salary", source.Id);
        var snapshot = new TransactionClassificationSnapshot(original.Status, category.Id, source.Id, original.Description);
        snapshot = field switch
        {
            "status" => snapshot with { Status = FinancialTransactionStatus.Reversed },
            "category" => snapshot with { CategoryId = Guid.NewGuid() },
            "source" => snapshot with { IncomeSourceId = null },
            _ => snapshot with { Description = "Older description" },
        };

        var failure = Assert.Throws<FinancialRuleException>(() =>
            original.CorrectClassification(category, source, "My update", snapshot));

        Assert.Equal(FinancialErrorCodes.TransactionChanged, failure.Code);
        Assert.Equal("Salary", original.Description);
        Assert.Equal(32_000, Assert.Single(original.Entries).Amount.Cents);
    }

    [Fact]
    public void MatchingSnapshotAllowsMetadataCorrectionAndPreservesFinancialFields()
    {
        var household = Guid.NewGuid();
        var category = Category.Create(Guid.NewGuid(), household, "Food", FinancialFlow.Expense);
        var original = FinancialTransaction.Expense(household, Guid.NewGuid(), category.Id,
            new Money(32_000), new DateOnly(2026, 11, 2), Guid.NewGuid(), "Groceries");
        var snapshot = new TransactionClassificationSnapshot(original.Status, category.Id, null, original.Description);

        var corrected = original.CorrectClassification(category, null, "Updated", snapshot);

        Assert.Equal("Updated", corrected.Description);
        Assert.Equal(original.Id, corrected.Id);
        Assert.Equal(original.OccurredOn, corrected.OccurredOn);
        Assert.Equal(original.Entries, corrected.Entries);
    }

    [Fact]
    public void AReversedOriginalRejectsThePreviouslyPostedSnapshotAsAConflict()
    {
        var household = Guid.NewGuid();
        var categoryId = Guid.NewGuid();
        var original = FinancialTransaction.Expense(household, Guid.NewGuid(), categoryId,
            new Money(32_000), new DateOnly(2026, 11, 2), Guid.NewGuid(), "Groceries");
        var reversed = FinancialTransaction.RestorePosted(original.Id, household, original.Kind,
            original.Description, original.OccurredOn, original.CreatedBy, null,
            FinancialTransactionStatus.Reversed, original.Entries);
        var snapshot = new TransactionClassificationSnapshot(FinancialTransactionStatus.Posted, categoryId, null, original.Description);

        var failure = Assert.Throws<FinancialRuleException>(() =>
            reversed.CorrectClassification(null, null, "Update", snapshot));

        Assert.Equal(FinancialErrorCodes.TransactionChanged, failure.Code);
    }
}
