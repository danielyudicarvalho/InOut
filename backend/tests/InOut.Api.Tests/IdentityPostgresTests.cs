using System.Security.Cryptography;
using System.Text;
using InOut.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace InOut.Api.Tests;

public sealed class DockerFactAttribute : FactAttribute
{
    public DockerFactAttribute()
    {
        if (!DockerAvailability.IsAvailable)
        {
            Skip = "Docker is not available; Postgres concurrency tests did not run.";
        }
    }
}

internal static class DockerAvailability
{
    public static bool IsAvailable =>
        File.Exists("/var/run/docker.sock") ||
        !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("DOCKER_HOST"));
}

public sealed class IdentityPostgresTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer postgres = new PostgreSqlBuilder("postgres:16-alpine").Build();
    private string connectionString = "";

    public async Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        await postgres.StartAsync();
        connectionString = postgres.GetConnectionString();
        var options = new DbContextOptionsBuilder<IdentityDbContext>()
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable("__ef_migrations", "identity"))
            .Options;
        await using var db = new IdentityDbContext(options);
        await db.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        if (DockerAvailability.IsAvailable)
        {
            await postgres.DisposeAsync();
        }
    }

    [DockerFact]
    public async Task ParallelTicketUpdateReturningConsumesOnce()
    {
        var userId = Guid.NewGuid();
        var hash = Convert.ToHexString(SHA256.HashData("login:shared-ticket"u8.ToArray()));
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await using (var db = CreateDb())
        {
            db.LoginTickets.Add(new LoginTicket
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Purpose = "login",
                TokenHash = hash,
                SecurityStamp = "stamp",
                ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(2)
            });
            await db.SaveChangesAsync();
        }

        async Task<Guid?> RedeemAsync()
        {
            await using var connection = new NpgsqlConnection(connectionString);
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand(
                """
                update identity.login_tickets
                set consumed_at = @now
                where purpose = 'login'
                  and token_hash = @hash
                  and consumed_at is null
                  and expires_at > @now
                returning user_id
                """,
                connection);
            command.Parameters.AddWithValue("now", now + 1);
            command.Parameters.AddWithValue("hash", hash);
            var scalar = await command.ExecuteScalarAsync();
            return scalar is Guid id ? id : null;
        }

        var results = await Task.WhenAll(RedeemAsync(), RedeemAsync(), RedeemAsync());
        Assert.Equal(1, results.Count(item => item == userId));
        Assert.Equal(2, results.Count(item => item is null));
    }

    [DockerFact]
    public async Task AuthAttemptBudgetIsSharedAcrossConnections()
    {
        var options = new DbContextOptionsBuilder<IdentityDbContext>()
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable("__ef_migrations", "identity"))
            .Options;
        await using var left = new IdentityDbContext(options);
        await using var right = new IdentityDbContext(options);
        var clock = TimeProvider.System;
        var first = new AuthAttemptBudget(left, clock);
        var second = new AuthAttemptBudget(right, clock);
        var key = "ip:203.0.113.9";
        var allowed = 0;
        var tasks = Enumerable.Range(0, AuthAttemptBudget.NetworkLimit + 4).Select(async index =>
        {
            var budget = index % 2 == 0 ? first : second;
            if (await budget.TryAsync(key, AuthAttemptBudget.NetworkLimit, AuthAttemptBudget.NetworkWindow, CancellationToken.None))
            {
                Interlocked.Increment(ref allowed);
            }
        });
        await Task.WhenAll(tasks);
        Assert.Equal(AuthAttemptBudget.NetworkLimit, allowed);
    }

    private IdentityDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<IdentityDbContext>()
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable("__ef_migrations", "identity"))
            .Options);
}
