using InOut.Application.Idempotency;
using Xunit;

namespace InOut.Api.Tests;

public sealed class IdempotencyRequestTests
{
    [Fact]
    public void SameSemanticIntentProducesSameFingerprint()
    {
        var tenantId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var key = Guid.NewGuid();

        var first = IdempotencyRequest.Create(
            tenantId,
            actorId,
            IdempotencyOperation.PostExpense,
            key,
            1_500,
            "BRL",
            new DateOnly(2026, 9, 17));
        var retry = IdempotencyRequest.Create(
            tenantId,
            actorId,
            IdempotencyOperation.PostExpense,
            key,
            1_500,
            "BRL",
            new DateOnly(2026, 9, 17));

        Assert.Equal(first.RequestFingerprint, retry.RequestFingerprint);
        Assert.Equal(64, first.RequestFingerprint.Length);
    }

    [Fact]
    public void ChangedPayloadOrOperationProducesDifferentFingerprint()
    {
        var tenantId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var key = Guid.NewGuid();
        var original = IdempotencyRequest.Create(
            tenantId,
            actorId,
            IdempotencyOperation.PostExpense,
            key,
            1_500);
        var changedPayload = IdempotencyRequest.Create(
            tenantId,
            actorId,
            IdempotencyOperation.PostExpense,
            key,
            2_000);
        var changedOperation = IdempotencyRequest.Create(
            tenantId,
            actorId,
            IdempotencyOperation.PostIncome,
            key,
            1_500);

        Assert.NotEqual(original.RequestFingerprint, changedPayload.RequestFingerprint);
        Assert.NotEqual(original.RequestFingerprint, changedOperation.RequestFingerprint);
    }

    [Fact]
    public void EmptyKeyIsRejectedBeforePersistence()
    {
        var exception = Assert.Throws<IdempotencyException>(() =>
            IdempotencyRequest.Create(
                Guid.NewGuid(),
                Guid.NewGuid(),
                IdempotencyOperation.CreateAccount,
                Guid.Empty,
                "payload"));

        Assert.Equal("invalid_idempotency_key", exception.Code);
    }
}
