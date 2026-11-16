using System.Net;
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

    public static void RejectDisabledTransport(string connectionString, bool production) =>
        RequireAuthenticatedTransport(connectionString, production, allowLocalInsecure: !production);

    public static void RequireAuthenticatedTransport(
        string connectionString,
        bool production,
        bool allowLocalInsecure,
        IReadOnlyCollection<string>? localTestHosts = null)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        var host = builder.Host ?? "";
        var local = IsLocalTestHost(host, localTestHosts);
        if (allowLocalInsecure && local && !production)
        {
            return;
        }

        if (production && allowLocalInsecure)
        {
            throw new InvalidOperationException(
                "Database:AllowInsecureLocalTransport is refused in production.");
        }

        var mode = builder.SslMode;
        if (mode is SslMode.VerifyFull or SslMode.VerifyCA)
        {
            return;
        }

        throw new InvalidOperationException(
            "Database connections must use Ssl Mode=VerifyFull or VerifyCA. Disable, Allow, Prefer, and Require without certificate authentication are refused. A local-test exception exists only for loopback (or Database:LocalTestHosts) when Database:AllowInsecureLocalTransport is true outside production.");
    }

    public static bool IsLocalTestHost(string? host, IReadOnlyCollection<string>? localTestHosts = null)
    {
        if (string.IsNullOrWhiteSpace(host))
        {
            return false;
        }

        if (string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(host, "127.0.0.1", StringComparison.Ordinal) ||
            string.Equals(host, "::1", StringComparison.Ordinal) ||
            string.Equals(host, "[::1]", StringComparison.Ordinal))
        {
            return true;
        }

        if (IPAddress.TryParse(host, out var address) && IPAddress.IsLoopback(address))
        {
            return true;
        }

        return localTestHosts is not null &&
               localTestHosts.Any(item => string.Equals(item, host, StringComparison.OrdinalIgnoreCase));
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
