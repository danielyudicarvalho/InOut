using Microsoft.EntityFrameworkCore;

namespace InOut.Infrastructure.Persistence;

public sealed partial class InOutDbContext
{
    internal DbSet<AccountRecord> Accounts => Set<AccountRecord>();
    internal DbSet<CategoryRecord> Categories => Set<CategoryRecord>();
    internal DbSet<FinancialTransactionRecord> FinancialTransactions => Set<FinancialTransactionRecord>();
    internal DbSet<EntryRecord> Entries => Set<EntryRecord>();

    private static void ConfigureFinancial(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AccountRecord>(entity =>
        {
            entity.ToTable("accounts", "public");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.HouseholdId).HasColumnName("household_id");
            entity.Property(item => item.Name).HasColumnName("name");
            entity.Property(item => item.Kind).HasColumnName("kind");
            entity.Property(item => item.Currency).HasColumnName("currency");
            entity.Property(item => item.CreatedBy).HasColumnName("created_by");
            entity.Property(item => item.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            entity.Property(item => item.ArchivedAt).HasColumnName("archived_at");
        });

        modelBuilder.Entity<CategoryRecord>(entity =>
        {
            entity.ToTable("categories", "public");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.HouseholdId).HasColumnName("household_id");
            entity.Property(item => item.ParentId).HasColumnName("parent_id");
            entity.Property(item => item.Name).HasColumnName("name");
            entity.Property(item => item.Flow).HasColumnName("flow");
            entity.Property(item => item.CreatedBy).HasColumnName("created_by");
            entity.Property(item => item.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            entity.Property(item => item.ArchivedAt).HasColumnName("archived_at");
        });

        modelBuilder.Entity<FinancialTransactionRecord>(entity =>
        {
            entity.ToTable("transactions", "public");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.HouseholdId).HasColumnName("household_id");
            entity.Property(item => item.Kind).HasColumnName("kind");
            entity.Property(item => item.Status).HasColumnName("status");
            entity.Property(item => item.Description).HasColumnName("description");
            entity.Property(item => item.OccurredOn).HasColumnName("occurred_on");
            entity.Property(item => item.IdempotencyKey).HasColumnName("idempotency_key");
            entity.Property(item => item.ReversalOf).HasColumnName("reversal_of");
            entity.Property(item => item.CreatedBy).HasColumnName("created_by");
            entity.Property(item => item.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            entity.Property(item => item.PostedAt).HasColumnName("posted_at");
            entity.HasMany(item => item.Entries)
                .WithOne()
                .HasForeignKey(item => new { item.HouseholdId, item.TransactionId })
                .HasPrincipalKey(item => new { item.HouseholdId, item.Id });
        });

        modelBuilder.Entity<EntryRecord>(entity =>
        {
            entity.ToTable("entries", "public");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.HouseholdId).HasColumnName("household_id");
            entity.Property(item => item.TransactionId).HasColumnName("transaction_id");
            entity.Property(item => item.AccountId).HasColumnName("account_id");
            entity.Property(item => item.CategoryId).HasColumnName("category_id");
            entity.Property(item => item.Direction).HasColumnName("direction");
            entity.Property(item => item.AmountCents).HasColumnName("amount_cents");
            entity.Property(item => item.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            entity.Property(item => item.CreatedBy).HasColumnName("created_by");
        });
    }
}

internal sealed class AccountRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Kind { get; set; } = string.Empty;
    public string Currency { get; set; } = "BRL";
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ArchivedAt { get; set; }
}

internal sealed class CategoryRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public Guid? ParentId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Flow { get; set; } = string.Empty;
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ArchivedAt { get; set; }
}

internal sealed class FinancialTransactionRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public string Kind { get; set; } = string.Empty;
    public string Status { get; set; } = "posted";
    public string? Description { get; set; }
    public DateOnly OccurredOn { get; set; }
    public Guid IdempotencyKey { get; set; }
    public Guid? ReversalOf { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? PostedAt { get; set; }
    public List<EntryRecord> Entries { get; set; } = [];
}

internal sealed class EntryRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public Guid TransactionId { get; set; }
    public Guid AccountId { get; set; }
    public Guid? CategoryId { get; set; }
    public string Direction { get; set; } = string.Empty;
    public long AmountCents { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public Guid CreatedBy { get; set; }
}
