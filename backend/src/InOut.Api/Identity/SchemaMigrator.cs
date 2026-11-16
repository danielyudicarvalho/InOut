using System.Security.Cryptography;
using System.Text;
using InOut.Infrastructure.Identity;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace InOut.Api.Identity;

public static class SchemaMigrator
{
    public static async Task<int> RunAsync(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json", optional: true)
            .AddEnvironmentVariables()
            .Build();
        var direct = configuration.GetConnectionString("InOutDirect")
            ?? throw new InvalidOperationException("ConnectionStrings:InOutDirect is required for migrations.");
        NpgsqlPoolSettings.RejectPoolerForDirect(direct);
        var production = string.Equals(
            configuration["ASPNETCORE_ENVIRONMENT"] ?? configuration["DOTNET_ENVIRONMENT"],
            "Production",
            StringComparison.OrdinalIgnoreCase);
        NpgsqlPoolSettings.RequireAuthenticatedTransport(
            direct,
            production,
            configuration.GetValue("Database:AllowInsecureLocalTransport", !production),
            configuration.GetSection("Database:LocalTestHosts").Get<string[]>() ?? ["db"]);
        var builder = new NpgsqlConnectionStringBuilder(direct);
        NpgsqlPoolSettings.ApplyDirectPool(builder);
        var root = FindRepoRoot();
        var files = new List<string>
        {
            Path.Combine(root, "db", "fly", "0000_roles_and_crypto.sql")
        };
        files.AddRange(Directory.GetFiles(Path.Combine(root, "db", "fly", "migrations"), "*.sql").OrderBy(path => path, StringComparer.Ordinal));
        files.Add(Path.Combine(root, "db", "fly", "9010_runtime_grants.sql"));
        await using var connection = new NpgsqlConnection(builder.ConnectionString);
        await connection.OpenAsync();
        await using (var timeout = new NpgsqlCommand("set lock_timeout = '15s'", connection))
        {
            await timeout.ExecuteNonQueryAsync();
        }

        await using var advisory = new NpgsqlCommand("select pg_advisory_lock(88112010)", connection);
        await advisory.ExecuteScalarAsync();
        try
        {
            var options = new DbContextOptionsBuilder<IdentityDbContext>()
                .UseNpgsql(connection, npgsql =>
                    npgsql.MigrationsHistoryTable("__ef_migrations", "identity"))
                .Options;
            await using (var identity = new IdentityDbContext(options))
            {
                await identity.Database.MigrateAsync();
            }

            await using (var setup = new NpgsqlCommand(
                """
                create table if not exists identity.schema_files (
                  filename text primary key,
                  sha256 text not null,
                  applied_at timestamptz not null default now()
                );
                """,
                connection))
            {
                await setup.ExecuteNonQueryAsync();
            }

            foreach (var file in files)
            {
                var sql = await File.ReadAllTextAsync(file);
                var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(sql))).ToLowerInvariant();
                var name = Path.GetFileName(file);
                await using var existing = new NpgsqlCommand(
                    "select sha256 from identity.schema_files where filename = $1",
                    connection);
                existing.Parameters.AddWithValue(name);
                var stored = await existing.ExecuteScalarAsync() as string;
                if (stored == hash)
                {
                    continue;
                }

                if (stored is not null)
                {
                    throw new InvalidOperationException($"SQL file {name} changed after it was applied.");
                }

                if (System.Text.RegularExpressions.Regex.IsMatch(sql, @"(?im)^\s*commit\s*;\s*$"))
                {
                    throw new InvalidOperationException(
                        $"SQL file {name} must not commit its own transaction. The migrator records the file hash in the same transaction.");
                }

                await using var transaction = await connection.BeginTransactionAsync();
                await using var command = new NpgsqlCommand(sql, connection, transaction);
                try
                {
                    await command.ExecuteNonQueryAsync();
                }
                catch (PostgresException exception)
                {
                    throw new InvalidOperationException(
                        $"SQL file {name} failed: {exception.MessageText}",
                        exception);
                }

                await using var record = new NpgsqlCommand(
                    "insert into identity.schema_files (filename, sha256) values ($1, $2)",
                    connection,
                    transaction);
                record.Parameters.AddWithValue(name);
                record.Parameters.AddWithValue(hash);
                await record.ExecuteNonQueryAsync();
                await transaction.CommitAsync();
            }

            await using (var prune = new NpgsqlCommand(
                """
                delete from identity.auth_attempts
                where window_start < (extract(epoch from now())::bigint / 900) - 8
                """,
                connection))
            {
                await prune.ExecuteNonQueryAsync();
            }

            var services = new ServiceCollection();
            services.AddLogging();
            services.AddDbContext<IdentityDbContext>(options =>
                options.UseNpgsql(connection, npgsql =>
                    npgsql.MigrationsHistoryTable("__ef_migrations", "identity")));
            services.AddOpenIddict()
                .AddCore(options => options.UseEntityFrameworkCore().UseDbContext<IdentityDbContext>());
            await using (var provider = services.BuildServiceProvider())
            await using (var scope = provider.CreateAsyncScope())
            {
                await IdentityHosting.SyncClientsAsync(
                    scope.ServiceProvider,
                    configuration,
                    production);
            }

            _ = args;
            return 0;
        }
        finally
        {
            await using var unlock = new NpgsqlCommand("select pg_advisory_unlock(88112010)", connection);
            await unlock.ExecuteScalarAsync();
        }
    }

    private static string FindRepoRoot()
    {
        foreach (var start in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
        {
            var current = new DirectoryInfo(start);
            while (current is not null)
            {
                if (Directory.Exists(Path.Combine(current.FullName, "db", "fly")))
                {
                    return current.FullName;
                }

                current = current.Parent;
            }
        }

        throw new InvalidOperationException("db/fly was not found.");
    }
}
