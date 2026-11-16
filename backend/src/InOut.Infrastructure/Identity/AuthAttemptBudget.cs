using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace InOut.Infrastructure.Identity;

public sealed class AuthAttemptBudget(IdentityDbContext db, TimeProvider clock)
{
    public const int NetworkLimit = 30;
    public const int AccountFailureLimit = 10;
    public const int ChallengeFailureLimit = 5;
    public static readonly TimeSpan NetworkWindow = TimeSpan.FromMinutes(1);
    public static readonly TimeSpan AccountWindow = TimeSpan.FromMinutes(15);

    public Task<bool> TryNetworkAsync(string ip, CancellationToken cancellationToken) =>
        TryAsync("ip:" + ip, NetworkLimit, NetworkWindow, cancellationToken);

    public Task<bool> TryAccountFailureAsync(string email, CancellationToken cancellationToken) =>
        TryAsync("account:" + email.Trim().ToUpperInvariant(), AccountFailureLimit, AccountWindow, cancellationToken);

    public async Task<bool> TryAsync(
        string key,
        int limit,
        TimeSpan window,
        CancellationToken cancellationToken)
    {
        var windowStart = clock.GetUtcNow().ToUnixTimeSeconds() / Math.Max(1, (long)window.TotalSeconds);
        if (db.Database.IsNpgsql())
        {
            var connection = db.Database.GetDbConnection();
            if (connection.State != ConnectionState.Open)
            {
                await db.Database.OpenConnectionAsync(cancellationToken);
            }

            await using var command = connection.CreateCommand();
            command.Transaction = db.Database.CurrentTransaction?.GetDbTransaction();
            command.CommandText = """
                insert into identity.auth_attempts ("key", window_start, count)
                values (@key, @window, 1)
                on conflict ("key", window_start)
                do update set count = identity.auth_attempts.count + 1
                returning count
                """;
            AddParameter(command, "key", key);
            AddParameter(command, "window", windowStart);
            var scalar = await command.ExecuteScalarAsync(cancellationToken);
            return Convert.ToInt32(scalar, System.Globalization.CultureInfo.InvariantCulture) <= limit;
        }

        var existing = await db.AuthAttempts.FindAsync([key, windowStart], cancellationToken);
        if (existing is null)
        {
            db.AuthAttempts.Add(new AuthAttempt { Key = key, WindowStart = windowStart, Count = 1 });
            await db.SaveChangesAsync(cancellationToken);
            return limit >= 1;
        }

        existing.Count++;
        await db.SaveChangesAsync(cancellationToken);
        return existing.Count <= limit;
    }

    private static void AddParameter(DbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }
}
