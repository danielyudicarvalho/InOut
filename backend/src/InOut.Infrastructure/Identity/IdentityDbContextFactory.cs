using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace InOut.Infrastructure.Identity;

/// <summary>
/// Design-time factory. The connection string is not used to migrate a live database;
/// <c>dotnet ef</c> only needs a Npgsql provider so the model uses the identity schema.
/// </summary>
public sealed class IdentityDbContextFactory : IDesignTimeDbContextFactory<IdentityDbContext>
{
    public IdentityDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<IdentityDbContext>()
            .UseNpgsql(
                "Host=127.0.0.1;Database=inout;Username=inout_api_runtime",
                npgsql => npgsql.MigrationsHistoryTable("__ef_migrations", "identity"))
            .Options;
        return new IdentityDbContext(options);
    }
}
