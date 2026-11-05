using System.Reflection;
using InOut.Application.Financial;
using InOut.Application.Idempotency;
using InOut.Domain.Financial;
using Xunit;
namespace InOut.Api.Tests;

public sealed class BudgetCurrencyIdempotencyTests
{
    [Fact]
    public async Task ServiceNormalizesCurrencyAndIncludesItAndLegacyResolutionIdInFingerprint()
    {
        var store = DispatchProxy.Create<ILedgerStore, BudgetStoreProbe>();
        var probe = (BudgetStoreProbe)(object)store;
        var service = new LedgerService(store);
        var actor = Guid.NewGuid();
        var command = new SetBudgetCommand(null, Guid.NewGuid(), Guid.NewGuid(),
            new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 31), 1000, Guid.NewGuid(), "USD");
        await service.SetBudgetAsync(actor, command, CancellationToken.None);
        await service.SetBudgetAsync(actor, command with { Currency = " usd " }, CancellationToken.None);
        await service.SetBudgetAsync(actor, command with { Currency = "BRL" }, CancellationToken.None);
        await service.SetBudgetAsync(actor, command with { Id = Guid.NewGuid() }, CancellationToken.None);
        Assert.Equal(probe.Requests[0].RequestFingerprint, probe.Requests[1].RequestFingerprint);
        Assert.NotEqual(probe.Requests[0].RequestFingerprint, probe.Requests[2].RequestFingerprint);
        Assert.NotEqual(probe.Requests[0].RequestFingerprint, probe.Requests[3].RequestFingerprint);
        Assert.All(probe.Currencies, currency => Assert.DoesNotContain(' ', currency));
        await Assert.ThrowsAsync<FinancialRuleException>(() => service.SetBudgetAsync(actor, command with { Currency = "" }, CancellationToken.None));
        Assert.Equal(4, probe.Requests.Count);
    }
    public class BudgetStoreProbe : DispatchProxy
    {
        public List<IdempotencyRequest> Requests { get; } = [];
        public List<string> Currencies { get; } = [];
        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod?.Name != nameof(ILedgerStore.SetBudgetAsync) || args is null) throw new NotSupportedException();
            var command = (SetBudgetCommand)args[1]!;
            Requests.Add((IdempotencyRequest)args[2]!); Currencies.Add(command.Currency);
            return Task.FromResult(new BudgetResult(command.Id ?? Guid.NewGuid(), command.HouseholdId,
                command.CategoryId, command.PeriodStart, command.PeriodEnd, command.LimitCents, false, command.Currency));
        }
    }
}
