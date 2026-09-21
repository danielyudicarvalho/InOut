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
}
