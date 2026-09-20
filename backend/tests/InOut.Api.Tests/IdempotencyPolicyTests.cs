using InOut.Application.Idempotency;
using InOut.Infrastructure.Idempotency;
using Xunit;

namespace InOut.Api.Tests;

public sealed class IdempotencyPolicyTests
{
    public static TheoryData<IdempotencyOperation> FinancialOperations => new()
    {
        IdempotencyOperation.CreateAccount,
        IdempotencyOperation.PostIncome,
        IdempotencyOperation.PostExpense,
        IdempotencyOperation.PostTransfer,
        IdempotencyOperation.ReverseTransaction,
    };

    [Theory]
    [MemberData(nameof(FinancialOperations))]
    public void FinancialCommandsUseShortLeaseAndNinetyDayRetention(
        IdempotencyOperation operation)
    {
        var policy = new IdempotencyPolicy().GetPolicy(operation);

        Assert.Equal(TimeSpan.FromSeconds(30), policy.LeaseDuration);
        Assert.Equal(TimeSpan.FromDays(90), policy.Retention);
    }

    [Fact]
    public void UnknownOperationFailsClosed()
    {
        var operation = (IdempotencyOperation)int.MaxValue;

        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new IdempotencyPolicy().GetPolicy(operation));
    }
}
