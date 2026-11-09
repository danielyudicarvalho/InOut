using System.Text;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace InOut.Infrastructure.Identity;

public sealed class EmailChallenge
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string Purpose { get; set; } = "";

    public string CodeHash { get; set; } = "";

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? ConsumedAt { get; set; }
}

public sealed class LoginTicket
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string Purpose { get; set; } = "";

    public string TokenHash { get; set; } = "";

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? ConsumedAt { get; set; }
}

public sealed class IdentityImportBatch
{
    public Guid Id { get; set; }

    public string SourceSha256 { get; set; } = "";

    public DateTimeOffset CompletedAt { get; set; }

    public string SummaryJson { get; set; } = "";
}

public sealed class IdentityDbContext(DbContextOptions<IdentityDbContext> options)
    : IdentityDbContext<InOutUser, IdentityRole<Guid>, Guid>(options),
        IDataProtectionKeyContext
{
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    public DbSet<EmailChallenge> EmailChallenges => Set<EmailChallenge>();

    public DbSet<LoginTicket> LoginTickets => Set<LoginTicket>();

    public DbSet<IdentityImportBatch> ImportBatches => Set<IdentityImportBatch>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        if (Database.ProviderName?.Contains("Npgsql", StringComparison.Ordinal) == true)
        {
            builder.HasDefaultSchema("identity");
        }

        base.OnModelCreating(builder);
        builder.Entity<InOutUser>(entity =>
        {
            entity.ToTable("users");
            entity.Property(user => user.DisplayName).HasMaxLength(100);
        });
        builder.Entity<IdentityRole<Guid>>().ToTable("roles");
        builder.Entity<IdentityUserRole<Guid>>().ToTable("user_roles");
        builder.Entity<IdentityUserClaim<Guid>>().ToTable("user_claims");
        builder.Entity<IdentityUserLogin<Guid>>().ToTable("user_logins");
        builder.Entity<IdentityUserToken<Guid>>().ToTable("user_tokens");
        builder.Entity<IdentityRoleClaim<Guid>>().ToTable("role_claims");
        builder.UseOpenIddict();
        builder.Entity<DataProtectionKey>().ToTable("data_protection_keys");
        builder.Entity<EmailChallenge>(entity =>
        {
            entity.ToTable("email_challenges");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Purpose).HasMaxLength(32).IsRequired();
            entity.Property(item => item.CodeHash).HasMaxLength(64).IsRequired();
            UseInstant(entity.Property(item => item.CreatedAt));
            UseInstant(entity.Property(item => item.ExpiresAt));
            UseInstant(entity.Property(item => item.ConsumedAt));
            entity.HasIndex(item => new { item.UserId, item.Purpose, item.CreatedAt });
        });
        builder.Entity<LoginTicket>(entity =>
        {
            entity.ToTable("login_tickets");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Purpose).HasMaxLength(32).IsRequired();
            entity.Property(item => item.TokenHash).HasMaxLength(64).IsRequired();
            UseInstant(entity.Property(item => item.ExpiresAt));
            UseInstant(entity.Property(item => item.ConsumedAt));
            entity.HasIndex(item => item.TokenHash).IsUnique();
        });
        builder.Entity<IdentityImportBatch>(entity =>
        {
            entity.ToTable("import_batches");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.SourceSha256).HasMaxLength(64).IsRequired();
            entity.HasIndex(item => item.SourceSha256).IsUnique();
            entity.Property(item => item.SummaryJson).IsRequired();
            UseInstant(entity.Property(item => item.CompletedAt));
        });

        // Domain SQL references identity.users(id). Keep every identity column snake_case.
        foreach (var entity in builder.Model.GetEntityTypes())
        {
            foreach (var property in entity.GetProperties())
            {
                property.SetColumnName(Snake(property.Name));
            }
        }
    }

    private static string Snake(string name)
    {
        var builder = new StringBuilder(name.Length + 4);
        for (var index = 0; index < name.Length; index++)
        {
            var character = name[index];
            if (char.IsUpper(character))
            {
                if (index > 0 &&
                    (char.IsLower(name[index - 1]) ||
                     (index + 1 < name.Length && char.IsLower(name[index + 1]))))
                {
                    builder.Append('_');
                }

                builder.Append(char.ToLowerInvariant(character));
            }
            else
            {
                builder.Append(character);
            }
        }

        return builder.ToString();
    }

    // SQLite has no timestamptz. Integer unix milliseconds compare on SQLite and Postgres.
    private static void UseInstant(Microsoft.EntityFrameworkCore.Metadata.Builders.PropertyBuilder<DateTimeOffset> property) =>
        property.HasConversion(
            value => value.ToUnixTimeMilliseconds(),
            value => DateTimeOffset.FromUnixTimeMilliseconds(value));

    private static void UseInstant(Microsoft.EntityFrameworkCore.Metadata.Builders.PropertyBuilder<DateTimeOffset?> property) =>
        property.HasConversion(
            value => value.HasValue ? (long?)value.Value.ToUnixTimeMilliseconds() : null,
            value => value.HasValue ? DateTimeOffset.FromUnixTimeMilliseconds(value.Value) : null);
}
