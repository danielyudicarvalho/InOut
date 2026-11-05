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
    internal DbSet<GoalAllocationRecord> GoalAllocations => Set<GoalAllocationRecord>();
    internal DbSet<RecurringPlanRecord> RecurringPlans => Set<RecurringPlanRecord>();
    internal DbSet<RecurringOccurrenceRecord> RecurringOccurrences => Set<RecurringOccurrenceRecord>();
    internal DbSet<ForecastRecord> Forecasts => Set<ForecastRecord>();
    internal DbSet<BudgetRevisionRecord> BudgetRevisions => Set<BudgetRevisionRecord>();
    internal DbSet<FinancialProjectRecord> FinancialProjects => Set<FinancialProjectRecord>();
    internal DbSet<ProjectLineRecord> ProjectLines => Set<ProjectLineRecord>();
    internal DbSet<ProjectMovementRecord> ProjectMovements => Set<ProjectMovementRecord>();
    internal DbSet<StatusTypeRecord> StatusTypes => Set<StatusTypeRecord>();
    internal DbSet<StatusValueRecord> StatusValues => Set<StatusValueRecord>();

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
            entity.Property(item => item.Status)
                .HasColumnName("status_id")
                .HasConversion<int>();
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
            entity.Property(item => item.Status)
                .HasColumnName("status_id")
                .HasConversion<int>();
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
            entity.Property(item => item.Status)
                .HasColumnName("status_id")
                .HasConversion<int>();
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
            entity.Property(item => item.Currency).HasColumnName("currency");
            entity.HasIndex(item => new { item.HouseholdId, item.CategoryId, item.PeriodStart, item.PeriodEnd, item.Currency })
                .IsUnique().HasDatabaseName("budgets_household_category_period_currency_key");
            entity.Property(item => item.CreatedBy).HasColumnName("created_by");
        });

        modelBuilder.Entity<GoalRecord>(entity =>
        {
            entity.ToTable("goals", "public");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.HouseholdId).HasColumnName("household_id");
            entity.Property(item => item.Name).HasColumnName("name");
            entity.Property(item => item.Currency).HasColumnName("currency");
            entity.Property(item => item.TargetCents).HasColumnName("target_cents");
            entity.Property(item => item.AllocatedCents).HasColumnName("allocated_cents");
            entity.Property(item => item.TargetDate).HasColumnName("target_date");
            entity.Property(item => item.Status)
                .HasColumnName("status_id")
                .HasConversion<int>();
            entity.Property(item => item.CreatedBy).HasColumnName("created_by");
            entity.Property(item => item.CreatedAt).HasColumnName("created_at");
            entity.Property(item => item.ArchivedAt).HasColumnName("archived_at");
        });

        modelBuilder.Entity<GoalAllocationRecord>(entity =>
        {
            entity.ToTable("goal_allocations", "public");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.HouseholdId).HasColumnName("household_id");
            entity.Property(item => item.GoalId).HasColumnName("goal_id");
            entity.Property(item => item.AmountCents).HasColumnName("amount_cents");
            entity.Property(item => item.Currency).HasColumnName("currency");
            entity.Property(item => item.Kind).HasColumnName("kind").HasConversion(
                value => DomainTypeStorage.GoalAllocationKindToString(value),
                value => DomainTypeStorage.GoalAllocationKindFromString(value));
            entity.Property(item => item.Origin).HasColumnName("origin").HasConversion(
                value => DomainTypeStorage.GoalAllocationOriginToString(value),
                value => DomainTypeStorage.GoalAllocationOriginFromString(value));
            entity.Property(item => item.ReversalOf).HasColumnName("reversal_of");
            entity.Property(item => item.OccurredOn).HasColumnName("occurred_on");
            entity.Property(item => item.Note).HasColumnName("note");
            entity.Property(item => item.CreatedBy).HasColumnName("created_by");
            entity.Property(item => item.CreatedAt).HasColumnName("created_at");
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
            entity.Property(item => item.Status)
                .HasColumnName("status_id")
                .HasConversion<int>();
            entity.Property(item => item.CreatedBy).HasColumnName("created_by");
            entity.Property(item => item.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            entity.Property(item => item.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<RecurringOccurrenceRecord>(entity =>
        {
            entity.ToTable("recurring_occurrences", "public");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.HouseholdId).HasColumnName("household_id");
            entity.Property(item => item.PlanId).HasColumnName("plan_id");
            entity.Property(item => item.ScheduledOn).HasColumnName("scheduled_on");
            entity.Property(item => item.TransactionId).HasColumnName("transaction_id");
            entity.Property(item => item.Flow).HasColumnName("flow").HasConversion(
                value => DomainTypeStorage.FinancialFlowToString(value),
                value => DomainTypeStorage.FinancialFlowFromString(value));
            entity.Property(item => item.AmountCents).HasColumnName("amount_cents");
            entity.Property(item => item.Currency).HasColumnName("currency");
            entity.Property(item => item.CreatedBy).HasColumnName("created_by");
            entity.Property(item => item.CreatedAt).HasColumnName("created_at");
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
            entity.Property(item => item.Assumptions).HasColumnName("assumptions").HasColumnType("jsonb");
            entity.Property(item => item.CalculatedAt).HasColumnName("calculated_at");
            entity.Property(item => item.CreatedBy).HasColumnName("created_by");
        });

        modelBuilder.Entity<StatusTypeRecord>(entity =>
        {
            entity.ToTable("status_types", "public");
            entity.HasKey(item => item.Code);
            entity.Property(item => item.Code).HasColumnName("code");
            entity.Property(item => item.Name).HasColumnName("name");
            entity.Property(item => item.Description).HasColumnName("description");
            entity.Property(item => item.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<StatusValueRecord>(entity =>
        {
            entity.ToTable("status_values", "public");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.TypeCode).HasColumnName("type_code");
            entity.Property(item => item.Code).HasColumnName("code");
            entity.Property(item => item.Name).HasColumnName("name");
            entity.Property(item => item.Description).HasColumnName("description");
            entity.Property(item => item.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<BudgetRevisionRecord>(entity =>
        {
            entity.ToTable("budget_revisions", "public");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.HouseholdId).HasColumnName("household_id");
            entity.Property(item => item.BudgetId).HasColumnName("budget_id");
            entity.Property(item => item.PreviousLimitCents).HasColumnName("previous_limit_cents");
            entity.Property(item => item.LimitCents).HasColumnName("limit_cents");
            entity.Property(item => item.Currency).HasColumnName("currency");
            entity.Property(item => item.CreatedBy).HasColumnName("created_by");
            entity.Property(item => item.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<FinancialProjectRecord>(entity =>
        {
            entity.ToTable("financial_projects", "public");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.HouseholdId).HasColumnName("household_id");
            entity.Property(item => item.Name).HasColumnName("name");
            entity.Property(item => item.Currency).HasColumnName("currency");
            entity.Property(item => item.PlannedCents).HasColumnName("planned_cents");
            entity.Property(item => item.StartsOn).HasColumnName("starts_on");
            entity.Property(item => item.EndsOn).HasColumnName("ends_on");
            entity.Property(item => item.Notes).HasColumnName("notes");
            entity.Property(item => item.Status).HasColumnName("status_id").HasConversion<int>();
            entity.Property(item => item.CreatedBy).HasColumnName("created_by");
            entity.Property(item => item.CreatedAt).HasColumnName("created_at");
            entity.Property(item => item.ClosedAt).HasColumnName("closed_at");
            entity.HasAlternateKey(item => new { item.HouseholdId, item.Id });
            entity.HasMany(item => item.Lines).WithOne()
                .HasForeignKey(item => new { item.HouseholdId, item.ProjectId })
                .HasPrincipalKey(item => new { item.HouseholdId, item.Id });
        });

        modelBuilder.Entity<ProjectLineRecord>(entity =>
        {
            entity.ToTable("financial_project_lines", "public");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.HouseholdId).HasColumnName("household_id");
            entity.Property(item => item.ProjectId).HasColumnName("project_id");
            entity.Property(item => item.Name).HasColumnName("name");
            entity.Property(item => item.Flow).HasColumnName("flow").HasConversion(
                value => DomainTypeStorage.FinancialFlowToString(value),
                value => DomainTypeStorage.FinancialFlowFromString(value));
            entity.Property(item => item.AmountCents).HasColumnName("amount_cents");
        });

        modelBuilder.Entity<ProjectMovementRecord>(entity =>
        {
            entity.ToTable("financial_project_movements", "public");
            entity.HasKey(item => new { item.HouseholdId, item.ProjectId, item.TransactionId });
            entity.Property(item => item.HouseholdId).HasColumnName("household_id");
            entity.Property(item => item.ProjectId).HasColumnName("project_id");
            entity.Property(item => item.TransactionId).HasColumnName("transaction_id");
            entity.Property(item => item.LinkedBy).HasColumnName("linked_by");
            entity.Property(item => item.LinkedAt).HasColumnName("linked_at");
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
    public AccountStatus Status { get; set; } = AccountStatus.Active;
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
    public CategoryStatus Status { get; set; } = CategoryStatus.Active;
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ArchivedAt { get; set; }
}

internal sealed class IncomeSourceRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public string Name { get; set; } = string.Empty;
    public IncomeSourceStatus Status { get; set; } = IncomeSourceStatus.Active;
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
    // NULL is reserved for legacy planning amounts awaiting explicit confirmation.
    public string? Currency { get; set; }
    public Guid CreatedBy { get; set; }
}

internal sealed class GoalRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public string Name { get; set; } = string.Empty;
    // NULL is reserved for legacy planning amounts awaiting explicit confirmation.
    public string? Currency { get; set; }
    public long TargetCents { get; set; }
    public long AllocatedCents { get; set; }
    public DateOnly? TargetDate { get; set; }
    public GoalStatus Status { get; set; } = GoalStatus.Active;
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ArchivedAt { get; set; }
}

internal sealed class GoalAllocationRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public Guid GoalId { get; set; }
    public long AmountCents { get; set; }
    public string Currency { get; set; } = string.Empty;
    public GoalAllocationKind Kind { get; set; }
    public GoalAllocationOrigin Origin { get; set; }
    public Guid? ReversalOf { get; set; }
    public DateOnly OccurredOn { get; set; }
    public string? Note { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
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

internal sealed class RecurringOccurrenceRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public Guid PlanId { get; set; }
    public DateOnly ScheduledOn { get; set; }
    public Guid TransactionId { get; set; }
    public FinancialFlow Flow { get; set; }
    public long AmountCents { get; set; }
    public string Currency { get; set; } = string.Empty;
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
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
    public string Assumptions { get; set; } = "[]";
    public DateTimeOffset CalculatedAt { get; set; }
    public Guid CreatedBy { get; set; }
}

internal sealed class BudgetRevisionRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public Guid BudgetId { get; set; }
    public long? PreviousLimitCents { get; set; }
    public long LimitCents { get; set; }
    public string Currency { get; set; } = string.Empty;
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

internal sealed class FinancialProjectRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Currency { get; set; } = string.Empty;
    public long PlannedCents { get; set; }
    public DateOnly StartsOn { get; set; }
    public DateOnly? EndsOn { get; set; }
    public string? Notes { get; set; }
    public FinancialProjectStatus Status { get; set; } = FinancialProjectStatus.Active;
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }
    public List<ProjectLineRecord> Lines { get; set; } = [];
}

internal sealed class ProjectLineRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public Guid ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public FinancialFlow Flow { get; set; }
    public long AmountCents { get; set; }
}

internal sealed class ProjectMovementRecord
{
    public Guid HouseholdId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid TransactionId { get; set; }
    public Guid LinkedBy { get; set; }
    public DateTimeOffset LinkedAt { get; set; }
}

internal sealed class StatusTypeRecord
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

internal sealed class StatusValueRecord
{
    public string TypeCode { get; set; } = string.Empty;
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
