using Npgsql;

namespace InOut.Infrastructure.Persistence;

public static class NpgsqlPoolSettings
{
    public const int FlyMaxConnectionLifetimeSeconds = 600;

    public const int FlyIdleConnectionSeconds = 300;

    public const string SessionPoolMode = "session";

    public static void ApplyRuntimePool(NpgsqlConnectionStringBuilder builder, int maxPoolSize)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(maxPoolSize);
        builder.Pooling = true;
        builder.MinPoolSize = 0;
        builder.MaxPoolSize = maxPoolSize;
        builder.ConnectionLifetime = FlyMaxConnectionLifetimeSeconds;
        builder.ConnectionIdleLifetime = FlyIdleConnectionSeconds;
        builder.Timeout = 15;
        builder.MaxAutoPrepare = 0;
        builder.NoResetOnClose = false;
    }

    public static void ApplyDirectPool(NpgsqlConnectionStringBuilder builder)
    {
        builder.Pooling = true;
        builder.MinPoolSize = 0;
        builder.MaxPoolSize = 2;
        builder.ConnectionLifetime = FlyMaxConnectionLifetimeSeconds;
        builder.ConnectionIdleLifetime = FlyIdleConnectionSeconds;
        builder.Timeout = 15;
        builder.MaxAutoPrepare = 0;
        builder.NoResetOnClose = false;
    }

    public static int AggregateClientConnections(
        int machineCount,
        int workerProcessCount,
        int maxPoolSize,
        int directPoolSize)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(machineCount);
        ArgumentOutOfRangeException.ThrowIfNegative(workerProcessCount);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(maxPoolSize);
        ArgumentOutOfRangeException.ThrowIfNegative(directPoolSize);
        return checked((machineCount + workerProcessCount) * maxPoolSize + directPoolSize);
    }

    public static void EnsureSessionPooling(string? poolMode)
    {
        if (!string.Equals(poolMode, SessionPoolMode, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "Database:PoolMode must be session. Fly transaction pooling stays off until Npgsql, EF, and OpenIddict are proven against it. Prepared statements and session-scoped state are not assumed.");
        }
    }

    public static void RejectDisabledTransport(string connectionString, bool production)
    {
        if (!production)
        {
            return;
        }

        if (connectionString.Contains("SSL Mode=Disable", StringComparison.OrdinalIgnoreCase) ||
            connectionString.Contains("SSLMode=Disable", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Production database connections cannot disable SSL.");
        }
    }

    public static void RejectPoolerForDirect(string connectionString)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        if (builder.Host?.Contains("pgbouncer", StringComparison.OrdinalIgnoreCase) == true)
        {
            throw new InvalidOperationException(
                "Migrations, LISTEN, and session advisory locks require the direct Fly endpoint, not the pooled host.");
        }
    }
}
