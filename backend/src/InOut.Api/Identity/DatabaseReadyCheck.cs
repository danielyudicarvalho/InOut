using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;

namespace InOut.Api.Identity;

public sealed class DatabaseReadyCheck(NpgsqlDataSource dataSource) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
            await using var command = new NpgsqlCommand("select 1", connection);
            var value = await command.ExecuteScalarAsync(cancellationToken);
            return Convert.ToInt32(value, System.Globalization.CultureInfo.InvariantCulture) == 1
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy("Database did not return 1.");
        }
        catch (Exception exception)
        {
            return HealthCheckResult.Unhealthy("Database is unreachable.", exception);
        }
    }
}
