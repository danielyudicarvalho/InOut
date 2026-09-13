using Microsoft.EntityFrameworkCore;

namespace InOut.Infrastructure.Persistence;

public sealed class InOutDbContext(DbContextOptions<InOutDbContext> options) : DbContext(options)
{
    internal DbSet<HouseholdRecord> Households => Set<HouseholdRecord>();
    internal DbSet<HouseholdMemberRecord> HouseholdMembers => Set<HouseholdMemberRecord>();
    internal DbSet<HouseholdInvitationRecord> HouseholdInvitations => Set<HouseholdInvitationRecord>();
    internal DbSet<AuditEventRecord> AuditEvents => Set<AuditEventRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<HouseholdRecord>(entity =>
        {
            entity.ToTable("households", "public");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.Name).HasColumnName("name");
            entity.Property(item => item.CreatedBy).HasColumnName("created_by");
            entity.Property(item => item.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            entity.Property(item => item.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<HouseholdMemberRecord>(entity =>
        {
            entity.ToTable("household_members", "public");
            entity.HasKey(item => new { item.HouseholdId, item.UserId });
            entity.Property(item => item.HouseholdId).HasColumnName("household_id");
            entity.Property(item => item.UserId).HasColumnName("user_id");
            entity.Property(item => item.Role).HasColumnName("role");
            entity.Property(item => item.JoinedAt).HasColumnName("joined_at").HasDefaultValueSql("now()");
            entity.HasOne(item => item.Household)
                .WithMany()
                .HasForeignKey(item => item.HouseholdId);
        });

        modelBuilder.Entity<HouseholdInvitationRecord>(entity =>
        {
            entity.ToTable("household_invitations", "private");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.HouseholdId).HasColumnName("household_id");
            entity.Property(item => item.TokenHash).HasColumnName("token_hash");
            entity.Property(item => item.CreatedBy).HasColumnName("created_by");
            entity.Property(item => item.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            entity.Property(item => item.ExpiresAt).HasColumnName("expires_at");
            entity.Property(item => item.AcceptedBy).HasColumnName("accepted_by");
            entity.Property(item => item.AcceptedAt).HasColumnName("accepted_at");
            entity.HasOne<HouseholdRecord>()
                .WithMany()
                .HasForeignKey(item => item.HouseholdId);
        });

        modelBuilder.Entity<AuditEventRecord>(entity =>
        {
            entity.ToTable("audit_events", "public");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(item => item.HouseholdId).HasColumnName("household_id");
            entity.Property(item => item.ActorUserId).HasColumnName("actor_user_id");
            entity.Property(item => item.Action).HasColumnName("action");
            entity.Property(item => item.EntityType).HasColumnName("entity_type");
            entity.Property(item => item.EntityId).HasColumnName("entity_id");
            entity.Property(item => item.Outcome).HasColumnName("outcome");
            entity.Property(item => item.OccurredAt).HasColumnName("occurred_at").HasDefaultValueSql("now()");
            entity.Property(item => item.Metadata).HasColumnName("metadata").HasColumnType("jsonb");
            entity.HasOne<HouseholdRecord>()
                .WithMany()
                .HasForeignKey(item => item.HouseholdId);
        });
    }
}

internal sealed class HouseholdRecord
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

internal sealed class HouseholdMemberRecord
{
    public Guid HouseholdId { get; set; }
    public Guid UserId { get; set; }
    public string Role { get; set; } = string.Empty;
    public DateTimeOffset JoinedAt { get; set; }
    public HouseholdRecord Household { get; set; } = null!;
}

internal sealed class HouseholdInvitationRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public byte[] TokenHash { get; set; } = [];
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public Guid? AcceptedBy { get; set; }
    public DateTimeOffset? AcceptedAt { get; set; }
}

internal sealed class AuditEventRecord
{
    public long Id { get; set; }
    public Guid HouseholdId { get; set; }
    public Guid? ActorUserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public Guid? EntityId { get; set; }
    public string Outcome { get; set; } = "success";
    public DateTimeOffset OccurredAt { get; set; }
    public string Metadata { get; set; } = "{}";
}
