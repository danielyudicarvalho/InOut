using InOut.Domain.Financial;
using Xunit;

namespace InOut.Domain.Tests;

public sealed class FinancialTransactionTests
{
    private static readonly Guid HouseholdId = Guid.NewGuid();
    private static readonly Guid ActorId = Guid.NewGuid();
    private static readonly DateOnly OccurredOn = new(2026, 9, 14);

    [Fact]
    public void MoneyRejectsNegativeAmounts()
    {
        var exception = Assert.Throws<FinancialRuleException>(() => new Money(-1));

        Assert.Equal("invalid_amount", exception.Code);
    }

    [Fact]
    public void MoneyRejectsMixedCurrencies()
    {
        var brl = new Money(100, "BRL");
        var usd = new Money(100, "USD");

        var exception = Assert.Throws<FinancialRuleException>(() => brl.Add(usd));

        Assert.Equal("currency_mismatch", exception.Code);
    }

    [Fact]
    public void IncomeCreatesCreditEntry()
    {
        var transaction = FinancialTransaction.Income(
            HouseholdId,
            Guid.NewGuid(),
            Guid.NewGuid(),
            new Money(150_00),
            OccurredOn,
            Guid.NewGuid(),
            ActorId,
            "Salary");

        var entry = Assert.Single(transaction.Entries);
        Assert.Equal(FinancialTransactionKind.Income, transaction.Kind);
        Assert.Equal(EntryDirection.Credit, entry.Direction);
        Assert.Equal(150_00, entry.Amount.Cents);
    }

    [Fact]
    public void OpeningBalanceIsExplicitAndHasNoCategory()
    {
        var transaction = FinancialTransaction.OpeningBalance(
            HouseholdId,
            Guid.NewGuid(),
            new Money(500_00),
            OccurredOn,
            Guid.NewGuid(),
            ActorId);

        var entry = Assert.Single(transaction.Entries);
        Assert.Equal(FinancialTransactionKind.OpeningBalance, transaction.Kind);
        Assert.Equal(EntryDirection.Credit, entry.Direction);
        Assert.Null(entry.CategoryId);
        Assert.Equal(500_00, entry.Amount.Cents);
    }

    [Fact]
    public void ExpenseCreatesDebitEntry()
    {
        var transaction = FinancialTransaction.Expense(
            HouseholdId,
            Guid.NewGuid(),
            Guid.NewGuid(),
            new Money(49_90),
            OccurredOn,
            Guid.NewGuid(),
            ActorId,
            "Groceries");

        Assert.Equal(EntryDirection.Debit, Assert.Single(transaction.Entries).Direction);
    }

    [Fact]
    public void TransferRequiresDifferentAccountsAndCreatesEqualOppositeEntries()
    {
        var source = Guid.NewGuid();
        var destination = Guid.NewGuid();

        var transaction = FinancialTransaction.Transfer(
            HouseholdId,
            source,
            destination,
            new Money(200_00),
            OccurredOn,
            Guid.NewGuid(),
            ActorId,
            null);

        Assert.Collection(
            transaction.Entries,
            debit =>
            {
                Assert.Equal(source, debit.AccountId);
                Assert.Equal(EntryDirection.Debit, debit.Direction);
            },
            credit =>
            {
                Assert.Equal(destination, credit.AccountId);
                Assert.Equal(EntryDirection.Credit, credit.Direction);
            });
        Assert.Equal(transaction.Entries[0].Amount, transaction.Entries[1].Amount);
    }

    [Fact]
    public void TransferRejectsSameAccount()
    {
        var accountId = Guid.NewGuid();

        var exception = Assert.Throws<FinancialRuleException>(() =>
            FinancialTransaction.Transfer(
                HouseholdId,
                accountId,
                accountId,
                new Money(100),
                OccurredOn,
                Guid.NewGuid(),
                ActorId,
                null));

        Assert.Equal("same_transfer_account", exception.Code);
    }

    [Fact]
    public void ReversalCreatesOppositeEntriesAndReferencesOriginal()
    {
        var original = FinancialTransaction.Expense(
            HouseholdId,
            Guid.NewGuid(),
            Guid.NewGuid(),
            new Money(75_00),
            OccurredOn,
            Guid.NewGuid(),
            ActorId,
            null);

        var reversal = FinancialTransaction.Reversal(
            original,
            Guid.NewGuid(),
            ActorId,
            OccurredOn.AddDays(1));

        Assert.Equal(original.Id, reversal.ReversalOf);
        Assert.Equal(FinancialTransactionKind.Reversal, reversal.Kind);
        var originalEntry = Assert.Single(original.Entries);
        var reversalEntry = Assert.Single(reversal.Entries);
        Assert.Equal(EntryDirection.Credit, reversalEntry.Direction);
        Assert.Equal(originalEntry.Amount, reversalEntry.Amount);
        Assert.Equal(originalEntry.AccountId, reversalEntry.AccountId);
        Assert.Equal(originalEntry.CategoryId, reversalEntry.CategoryId);
    }

    [Fact]
    public void ReversalRejectsAnAlreadyReversedTransaction()
    {
        var accountId = Guid.NewGuid();
        var original = FinancialTransaction.RestorePosted(
            Guid.NewGuid(),
            HouseholdId,
            FinancialTransactionKind.Expense,
            null,
            OccurredOn,
            Guid.NewGuid(),
            ActorId,
            null,
            FinancialTransactionStatus.Reversed,
            [
                new LedgerEntry(
                    Guid.NewGuid(),
                    accountId,
                    Guid.NewGuid(),
                    EntryDirection.Debit,
                    new Money(75_00)),
            ]);

        var exception = Assert.Throws<FinancialRuleException>(() =>
            FinancialTransaction.Reversal(
                original,
                Guid.NewGuid(),
                ActorId,
                OccurredOn.AddDays(1)));

        Assert.Equal("transaction_not_reversible", exception.Code);
    }

    [Fact]
    public void ReferenceValidationRejectsArchivedAccounts()
    {
        var accountId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();
        var transaction = FinancialTransaction.Expense(
            HouseholdId,
            accountId,
            categoryId,
            new Money(100),
            OccurredOn,
            Guid.NewGuid(),
            ActorId,
            null);
        var account = new Account(
            accountId,
            HouseholdId,
            "Checking",
            AccountKind.Checking,
            "BRL",
            DateTimeOffset.UtcNow);
        var category = new Category(
            categoryId,
            HouseholdId,
            FinancialFlow.Expense,
            null);

        var exception = Assert.Throws<FinancialRuleException>(() =>
            transaction.ValidateReferences([account], [category]));

        Assert.Equal("invalid_account", exception.Code);
    }

    [Fact]
    public void ReferenceValidationRejectsCategoryFromTheWrongFlow()
    {
        var accountId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();
        var transaction = FinancialTransaction.Expense(
            HouseholdId,
            accountId,
            categoryId,
            new Money(100),
            OccurredOn,
            Guid.NewGuid(),
            ActorId,
            null);
        var account = Account.Create(
            accountId,
            HouseholdId,
            "Checking",
            AccountKind.Checking,
            "BRL");
        var category = new Category(
            categoryId,
            HouseholdId,
            FinancialFlow.Income,
            null);

        var exception = Assert.Throws<FinancialRuleException>(() =>
            transaction.ValidateReferences([account], [category]));

        Assert.Equal("invalid_category", exception.Code);
    }

    [Fact]
    public void IdempotencyKeyIsRequired()
    {
        var exception = Assert.Throws<FinancialRuleException>(() =>
            FinancialTransaction.Income(
                HouseholdId,
                Guid.NewGuid(),
                Guid.NewGuid(),
                new Money(100),
                OccurredOn,
                Guid.Empty,
                ActorId,
                null));

        Assert.Equal("invalid_idempotency_key", exception.Code);
    }
}
