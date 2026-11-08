using InOut.Infrastructure.Persistence;
using Xunit;
using Npgsql;

namespace InOut.Api.Tests;

public sealed class NpgsqlPoolSettingsTests
{
    [Fact]
    public void AppliesFlyLifetimeIdleAndBoundedPoolWithoutTransactionModeFlags()
    {
        var builder = new NpgsqlConnectionStringBuilder("Host=pgbouncer.example.flympg.net;Database=fly-db;Username=app");
        NpgsqlPoolSettings.ApplyRuntimePool(builder, 10);
        Assert.Equal(600, builder.ConnectionLifetime);
        Assert.Equal(300, builder.ConnectionIdleLifetime);
        Assert.Equal(10, builder.MaxPoolSize);
        Assert.Equal(0, builder.MinPoolSize);
        Assert.Equal(0, builder.MaxAutoPrepare);
        Assert.False(builder.NoResetOnClose);
        Assert.True(builder.Pooling);
        Assert.Equal(32, NpgsqlPoolSettings.AggregateClientConnections(2, 1, 10, 2));
        Assert.Throws<InvalidOperationException>(() => NpgsqlPoolSettings.EnsureSessionPooling("transaction"));
        Assert.Throws<InvalidOperationException>(() =>
            NpgsqlPoolSettings.RejectPoolerForDirect(builder.ConnectionString));
    }
}
