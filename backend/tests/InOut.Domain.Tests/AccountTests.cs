using InOut.Domain.Financial;
using Xunit;

namespace InOut.Domain.Tests;

public sealed class AccountTests
{
    [Fact]
    public void OpeningRejectsNegativeInitialBalance()
    {
        var exception = Assert.Throws<FinancialRuleException>(() =>
            Account.Open(
                Guid.NewGuid(),
                Guid.NewGuid(),
                "Checking",
                AccountKind.Checking,
                "BRL",
                -1,
                new DateOnly(2026, 9, 15),
                Guid.NewGuid()));

        Assert.Equal("invalid_initial_balance", exception.Code);
    }

    [Fact]
    public void OpeningCreatesAnExplicitTransactionForPositiveBalance()
    {
        var accountId = Guid.NewGuid();
        var opening = Account.Open(
            accountId,
            Guid.NewGuid(),
            "Checking",
            AccountKind.Checking,
            "BRL",
            10_000,
            new DateOnly(2026, 9, 15),
            Guid.NewGuid());

        Assert.Equal(accountId, opening.Account.Id);
        var openingBalance = Assert.IsType<FinancialTransaction>(opening.OpeningBalance);
        Assert.Equal(
            FinancialTransactionKind.OpeningBalance,
            openingBalance.Kind);
    }

    [Fact]
    public void ArchiveChangesStateWithoutReplacingIdentity()
    {
        var account = Account.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Checking",
            AccountKind.Checking,
            "BRL");
        var archivedAt = new DateTimeOffset(2026, 9, 15, 12, 0, 0, TimeSpan.Zero);

        var archived = account.Archive(archivedAt);

        Assert.Equal(account.Id, archived.Id);
        Assert.False(archived.IsActive);
        Assert.Equal(archivedAt, archived.ArchivedAt);
    }

    [Fact]
    public void UpdateMetadataModifiesNameAndKindForActiveAccount()
    {
        var account = Account.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Conta Antiga",
            AccountKind.Checking,
            "BRL");

        var updated = account.UpdateMetadata("  Conta Nova  ", AccountKind.Savings);

        Assert.Equal("Conta Nova", updated.Name);
        Assert.Equal(AccountKind.Savings, updated.Kind);
        Assert.Equal(account.Currency, updated.Currency);
    }

    [Fact]
    public void UpdateMetadataThrowsWhenAccountIsArchived()
    {
        var account = Account.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Conta",
            AccountKind.Checking,
            "BRL").Archive(DateTimeOffset.UtcNow);

        var ex = Assert.Throws<FinancialRuleException>(() => account.UpdateMetadata("Novo Nome", AccountKind.Savings));
        Assert.Equal(FinancialErrorCodes.AccountArchived, ex.Code);
    }

    [Fact]
    public void FreezeAndUnfreezeTransitionsAccountState()
    {
        var account = Account.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Investimentos",
            AccountKind.Investment,
            "BRL");

        Assert.Equal(AccountStatus.Active, account.Status);
        Assert.True(account.CanTransact);

        var frozen = account.Freeze();
        Assert.Equal(AccountStatus.Frozen, frozen.Status);
        Assert.False(frozen.CanTransact);

        var ex = Assert.Throws<FinancialRuleException>(() => frozen.EnsureCanTransact());
        Assert.Equal(FinancialErrorCodes.AccountFrozen, ex.Code);

        var updateEx = Assert.Throws<FinancialRuleException>(() => frozen.UpdateMetadata("Novo", AccountKind.Savings));
        Assert.Equal(FinancialErrorCodes.AccountFrozen, updateEx.Code);

        var unfrozen = frozen.Unfreeze();
        Assert.Equal(AccountStatus.Active, unfrozen.Status);
        Assert.True(unfrozen.CanTransact);
    }

    [Fact]
    public void ArchivedAccountRejectsTransactingFreezingAndUnfreezing()
    {
        var account = Account.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Conta",
            AccountKind.Checking,
            "BRL").Archive(DateTimeOffset.UtcNow);

        Assert.Equal(AccountStatus.Archived, account.Status);
        Assert.False(account.CanTransact);

        var transactEx = Assert.Throws<FinancialRuleException>(() => account.EnsureCanTransact());
        Assert.Equal(FinancialErrorCodes.AccountArchived, transactEx.Code);

        var freezeEx = Assert.Throws<FinancialRuleException>(() => account.Freeze());
        Assert.Equal(FinancialErrorCodes.AccountArchived, freezeEx.Code);

        var unfreezeEx = Assert.Throws<FinancialRuleException>(() => account.Unfreeze());
        Assert.Equal(FinancialErrorCodes.AccountArchived, unfreezeEx.Code);
    }

    [Fact]
    public void EnsureBelongsToHouseholdRejectsDifferentHousehold()
    {
        var householdId = Guid.NewGuid();
        var otherHouseholdId = Guid.NewGuid();
        var account = Account.Create(Guid.NewGuid(), householdId, "Wallet", AccountKind.Cash, "BRL");

        account.EnsureBelongsToHousehold(householdId);

        var ex = Assert.Throws<FinancialRuleException>(() => account.EnsureBelongsToHousehold(otherHouseholdId));
        Assert.Equal(FinancialErrorCodes.InvalidAccount, ex.Code);
    }

    [Fact]
    public void NameLengthBoundaryValidation()
    {
        var valid80 = new string('A', Account.MaxNameLength);
        var account = Account.Create(Guid.NewGuid(), Guid.NewGuid(), valid80, AccountKind.Checking, "BRL");
        Assert.Equal(valid80, account.Name);

        var invalid81 = new string('A', Account.MaxNameLength + 1);
        var ex = Assert.Throws<FinancialRuleException>(() =>
            Account.Create(Guid.NewGuid(), Guid.NewGuid(), invalid81, AccountKind.Checking, "BRL"));
        Assert.Equal(FinancialErrorCodes.InvalidAccountName, ex.Code);
    }
}
