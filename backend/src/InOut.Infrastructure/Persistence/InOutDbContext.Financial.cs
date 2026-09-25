using InOut.Domain.Financial;
using Microsoft.EntityFrameworkCore;

namespace InOut.Infrastructure.Persistence;

public sealed partial class InOutDbContext
{
    internal DbSet<AccountRecord> Accounts => Set<AccountRecord>();
    internal DbSet<IncomeSourceRecord> IncomeSources => Set<IncomeSourceRecord>();
    internal DbSet<CategoryRecord> Categories => Set<CategoryRecord>();
    internal DbSet<FinancialTransactionRecord> FinancialTransactions => Set<FinancialTransactionRecord>();
    internal DbSet<EntryRecord> Entries => Set<EntryRecord>();
    internal DbSet<BudgetRecord> Budgets => Set<BudgetRecord>();
    internal DbSet<GoalRecord> Goals => Set<GoalRecord>();
    internal DbSet<RecurringPlanRecord> RecurringPlans => Set<RecurringPlanRecord>();
    internal DbSet<ForecastRecord> Forecasts => Set<ForecastRecord>();

    private static void ConfigureFinancial(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AccountRecord>(entity =>
        {
            entity.ToTable("accounts", "public");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.HouseholdId).HasColumnName("household_id");
            entity.Property(item => item.Name).HasColumnName("name");
            entity.Property(item => item.Kind)
                .HasColumnName("kind")
                .HasConversion(
                    value => DomainTypeStorage.AccountKindToString(value),
                    value => DomainTypeStorage.AccountKindFromString(value));
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
            entity.Property(item => item.Flow)
                .HasColumnName("flow")
                .HasConversion(
                    value => DomainTypeStorage.FinancialFlowToString(value),
                    value => DomainTypeStorage.FinancialFlowFromString(value));
            entity.Property(item => item.CreatedBy).HasColumnName("created_by");
            entity.Property(item => item.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            entity.Property(item => item.ArchivedAt).HasColumnName("archived_at");
        });

        modelBuilder.Entity<IncomeSourceRecord>(entity =>
        {
            entity.ToTable("income_sources", "public");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.HouseholdId).HasColumnName("household_id");
            entity.Property(item => item.Name).HasColumnName("name");
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
            entity.Property(item => item.Kind)
                .HasColumnName("kind")
                .HasConversion(
                    value => DomainTypeStorage.TransactionKindToString(value),
                    value => DomainTypeStorage.TransactionKindFromString(value));
            entity.Property(item => item.Status)
                .HasColumnName("status")
                .HasConversion(
                    value => DomainTypeStorage.TransactionStatusToString(value),
                    value => DomainTypeStorage.TransactionStatusFromString(value));
            entity.Property(item => item.Description).HasColumnName("description");
            entity.Property(item => item.OccurredOn).HasColumnName("occurred_on");
            entity.Property(item => item.ReversalOf).HasColumnName("reversal_of");
            entity.Property(item => item.IncomeSourceId).HasColumnName("income_source_id");
            entity.Property(item => item.OpeningAccountId).HasColumnName("opening_account_id");
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
            entity.Property(item => item.Direction)
                .HasColumnName("direction")
                .HasConversion(
                    value => DomainTypeStorage.EntryDirectionToString(value),
                    value => DomainTypeStorage.EntryDirectionFromString(value));
            entity.Property(item => item.AmountCents).HasColumnName("amount_cents");
            entity.Property(item => item.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            entity.Property(item => item.CreatedBy).HasColumnName("created_by");
        });

        modelBuilder.Entity<BudgetRecord>(entity =>
        {
            entity.ToTable("budgets", "public");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.HouseholdId).HasColumnName("household_id");
            entity.Property(item => item.CategoryId).HasColumnName("category_id");
            entity.Property(item => item.PeriodStart).HasColumnName("period_start");
            entity.Property(item => item.PeriodEnd).HasColumnName("period_end");
            entity.Property(item => item.LimitCents).HasColumnName("limit_cents");
        });

        modelBuilder.Entity<GoalRecord>(entity =>
        {
            entity.ToTable("goals", "public");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.HouseholdId).HasColumnName("household_id");
            entity.Property(item => item.Name).HasColumnName("name");
            entity.Property(item => item.TargetCents).HasColumnName("target_cents");
            entity.Property(item => item.AllocatedCents).HasColumnName("allocated_cents");
            entity.Property(item => item.TargetDate).HasColumnName("target_date");
            entity.Property(item => item.ArchivedAt).HasColumnName("archived_at");
        });

        modelBuilder.Entity<RecurringPlanRecord>(entity =>
        {
            entity.ToTable("recurring_plans", "public");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.HouseholdId).HasColumnName("household_id");
            entity.Property(item => item.Name).HasColumnName("name");
            entity.Property(item => item.Flow).HasColumnName("flow").HasConversion(
                value => DomainTypeStorage.FinancialFlowToString(value),
                value => DomainTypeStorage.FinancialFlowFromString(value));
            entity.Property(item => item.AccountId).HasColumnName("account_id");
            entity.Property(item => item.CategoryId).HasColumnName("category_id");
            entity.Property(item => item.IncomeSourceId).HasColumnName("income_source_id");
            entity.Property(item => item.AmountCents).HasColumnName("amount_cents");
            entity.Property(item => item.Currency).HasColumnName("currency");
            entity.Property(item => item.DayOfMonth).HasColumnName("day_of_month");
            entity.Property(item => item.StartsOn).HasColumnName("starts_on");
            entity.Property(item => item.EndsOn).HasColumnName("ends_on");
            entity.Property(item => item.Status).HasColumnName("status").HasConversion(
                value => value.ToString().ToLowerInvariant(),
                value => Enum.Parse<RecurringPlanStatus>(value, true));
            entity.Property(item => item.CreatedBy).HasColumnName("created_by");
            entity.Property(item => item.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            entity.Property(item => item.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<ForecastRecord>(entity =>
        {
            entity.ToTable("forecasts", "public");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.HouseholdId).HasColumnName("household_id");
            entity.Property(item => item.AccountId).HasColumnName("account_id");
            entity.Property(item => item.Currency).HasColumnName("currency");
            entity.Property(item => item.AsOf).HasColumnName("as_of");
            entity.Property(item => item.Months).HasColumnName("months");
            entity.Property(item => item.OpeningBalanceCents).HasColumnName("opening_balance_cents");
            entity.Property(item => item.Points).HasColumnName("points").HasColumnType("jsonb");
            entity.Property(item => item.CalculatedAt).HasColumnName("calculated_at");
            entity.Property(item => item.CreatedBy).HasColumnName("created_by");
        });
    }
}

internal sealed class AccountRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public string Name { get; set; } = string.Empty;
    public AccountKind Kind { get; set; }
    public string Currency { get; set; } = Money.DefaultCurrency;
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
    public FinancialFlow Flow { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ArchivedAt { get; set; }
}

internal sealed class IncomeSourceRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ArchivedAt { get; set; }
}

internal sealed class FinancialTransactionRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public FinancialTransactionKind Kind { get; set; }
    public FinancialTransactionStatus Status { get; set; } = FinancialTransactionStatus.Posted;
    public string? Description { get; set; }
    public DateOnly OccurredOn { get; set; }
    public Guid? ReversalOf { get; set; }
    public Guid? IncomeSourceId { get; set; }
    public Guid? OpeningAccountId { get; set; }
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
    public EntryDirection Direction { get; set; }
    public long AmountCents { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public Guid CreatedBy { get; set; }
}

internal sealed class BudgetRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public Guid CategoryId { get; set; }
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public long LimitCents { get; set; }
}

internal sealed class GoalRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public string Name { get; set; } = string.Empty;
    public long TargetCents { get; set; }
    public long AllocatedCents { get; set; }
    public DateOnly? TargetDate { get; set; }
    public DateTimeOffset? ArchivedAt { get; set; }
}

internal sealed class RecurringPlanRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public string Name { get; set; } = string.Empty;
    public FinancialFlow Flow { get; set; }
    public Guid AccountId { get; set; }
    public Guid CategoryId { get; set; }
    public Guid? IncomeSourceId { get; set; }
    public long AmountCents { get; set; }
    public string Currency { get; set; } = Money.DefaultCurrency;
    public int DayOfMonth { get; set; }
    public DateOnly StartsOn { get; set; }
    public DateOnly? EndsOn { get; set; }
    public RecurringPlanStatus Status { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

internal sealed class ForecastRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public Guid AccountId { get; set; }
    public string Currency { get; set; } = Money.DefaultCurrency;
    public DateOnly AsOf { get; set; }
    public int Months { get; set; }
    public long OpeningBalanceCents { get; set; }
    public string Points { get; set; } = "[]";
    public DateTimeOffset CalculatedAt { get; set; }
    public Guid CreatedBy { get; set; }
}
