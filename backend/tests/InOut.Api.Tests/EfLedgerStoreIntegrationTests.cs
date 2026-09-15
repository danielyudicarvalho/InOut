using InOut.Application.Financial;
using InOut.Domain.Financial;
using InOut.Infrastructure.Financial;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace InOut.Api.Tests;

public sealed class EfLedgerStoreIntegrationTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer postgres = new PostgreSqlBuilder("postgres:17-alpine")
        .Build();

    private readonly Guid householdId = Guid.NewGuid();
    private readonly Guid actorUserId = Guid.NewGuid();
    private readonly Guid accountId = Guid.NewGuid();
    private readonly Guid categoryId = Guid.NewGuid();

    public async Task InitializeAsync()
    {
        await postgres.StartAsync();
        await using var connection = new NpgsqlConnection(postgres.GetConnectionString());
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = Schema;
        await command.ExecuteNonQueryAsync();

        await using var seed = connection.CreateCommand();
        seed.CommandText = """
            insert into public.households (id, name, created_by)
            values (@household_id, 'Integration household', @actor_user_id);
            insert into public.accounts (id, household_id, name, kind, currency, created_by)
            values (@account_id, @household_id, 'Checking', 'checking', 'BRL', @actor_user_id);
            insert into public.categories (id, household_id, name, flow, created_by)
            values (@category_id, @household_id, 'Salary', 'income', @actor_user_id);
            """;
        seed.Parameters.AddWithValue("household_id", householdId);
        seed.Parameters.AddWithValue("actor_user_id", actorUserId);
        seed.Parameters.AddWithValue("account_id", accountId);
        seed.Parameters.AddWithValue("category_id", categoryId);
        await seed.ExecuteNonQueryAsync();
    }

    public async Task DisposeAsync() => await postgres.DisposeAsync();

    [Fact]
    public async Task ConcurrentRetriesWithSameKeyCreateOneTransaction()
    {
        var idempotencyKey = Guid.NewGuid();
        var first = PostIncomeAsync(idempotencyKey);
        var second = PostIncomeAsync(idempotencyKey);

        var results = await Task.WhenAll(first, second);

        Assert.Equal(results[0].TransactionId, results[1].TransactionId);
        Assert.Single(results, result => result.Replayed);
        Assert.Single(results, result => !result.Replayed);

        await using var context = CreateContext();
        var store = new EfLedgerStore(context);
        var balances = await store.GetBalancesAsync(householdId, CancellationToken.None);
        var reconciliation = await store.ReconcileAsync(householdId, CancellationToken.None);
        Assert.Equal(1_000, Assert.Single(balances).BalanceCents);
        Assert.True(reconciliation.IsConsistent);
        Assert.Equal(1, reconciliation.PostedTransactionCount);
        Assert.Equal(1, reconciliation.EntryTransactionCount);
    }

    [Fact]
    public async Task ConcurrentReversalsAllowOnlyOneReversal()
    {
        var posted = await PostIncomeAsync(Guid.NewGuid());
        var first = ReverseAsync(posted.TransactionId, Guid.NewGuid());
        var second = ReverseAsync(posted.TransactionId, Guid.NewGuid());

        var outcomes = await Task.WhenAll(Capture(first), Capture(second));

        Assert.Single(outcomes, outcome => outcome.Result is not null);
        var failure = Assert.Single(outcomes, outcome => outcome.Error is not null).Error;
        Assert.Equal("transaction_not_reversible", Assert.IsType<FinancialRuleException>(failure).Code);

        await using var context = CreateContext();
        var balances = await new EfLedgerStore(context)
            .GetBalancesAsync(householdId, CancellationToken.None);
        Assert.Equal(0, Assert.Single(balances).BalanceCents);
    }

    private async Task<LedgerWriteResult> PostIncomeAsync(Guid idempotencyKey)
    {
        await using var context = CreateContext();
        var service = new LedgerService(new EfLedgerStore(context));
        return await service.PostIncomeAsync(
            actorUserId,
            new PostIncomeCommand(
                householdId,
                accountId,
                categoryId,
                1_000,
                "BRL",
                new DateOnly(2026, 9, 14),
                idempotencyKey,
                "Salary"),
            CancellationToken.None);
    }

    private async Task<LedgerWriteResult> ReverseAsync(Guid transactionId, Guid idempotencyKey)
    {
        await using var context = CreateContext();
        var service = new LedgerService(new EfLedgerStore(context));
        return await service.ReverseAsync(
            actorUserId,
            new ReverseTransactionCommand(
                householdId,
                transactionId,
                new DateOnly(2026, 9, 15),
                idempotencyKey,
                "Correction"),
            CancellationToken.None);
    }

    private InOutDbContext CreateContext() => new(
        new DbContextOptionsBuilder<InOutDbContext>()
            .UseNpgsql(postgres.GetConnectionString())
            .Options);

    private static async Task<Outcome> Capture(Task<LedgerWriteResult> operation)
    {
        try
        {
            return new Outcome(await operation, null);
        }
        catch (Exception exception)
        {
            return new Outcome(null, exception);
        }
    }

    private sealed record Outcome(LedgerWriteResult? Result, Exception? Error);

    private const string Schema = """
        create table public.households (
          id uuid primary key,
          name text not null,
          created_by uuid not null,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
        create table public.household_members (
          household_id uuid not null references public.households(id),
          user_id uuid not null,
          role text not null,
          joined_at timestamptz not null default now(),
          primary key (household_id, user_id)
        );
        create table public.accounts (
          id uuid primary key,
          household_id uuid not null references public.households(id),
          name text not null,
          kind text not null,
          currency text not null,
          created_by uuid not null,
          created_at timestamptz not null default now(),
          archived_at timestamptz,
          unique (household_id, id)
        );
        create table public.categories (
          id uuid primary key,
          household_id uuid not null references public.households(id),
          parent_id uuid,
          name text not null,
          flow text not null,
          created_by uuid not null,
          created_at timestamptz not null default now(),
          archived_at timestamptz,
          unique (household_id, id)
        );
        create table public.transactions (
          id uuid primary key,
          household_id uuid not null references public.households(id),
          kind text not null,
          status text not null,
          description text,
          occurred_on date not null,
          idempotency_key uuid not null,
          reversal_of uuid,
          created_by uuid not null,
          created_at timestamptz not null default now(),
          posted_at timestamptz,
          unique (household_id, id),
          unique (household_id, idempotency_key),
          foreign key (household_id, reversal_of) references public.transactions(household_id, id)
        );
        create table public.entries (
          id uuid primary key,
          household_id uuid not null references public.households(id),
          transaction_id uuid not null,
          account_id uuid not null,
          category_id uuid,
          direction text not null,
          amount_cents bigint not null,
          created_at timestamptz not null default now(),
          created_by uuid not null,
          foreign key (household_id, transaction_id) references public.transactions(household_id, id),
          foreign key (household_id, account_id) references public.accounts(household_id, id),
          foreign key (household_id, category_id) references public.categories(household_id, id)
        );
        create table public.audit_events (
          id bigint generated by default as identity primary key,
          household_id uuid not null references public.households(id),
          actor_user_id uuid,
          action text not null,
          entity_type text not null,
          entity_id uuid,
          outcome text not null default 'success',
          occurred_at timestamptz not null default now(),
          metadata jsonb not null default '{}'::jsonb
        );
        create schema private;
        create table private.household_invitations (
          id uuid primary key,
          household_id uuid not null references public.households(id),
          token_hash bytea not null,
          created_by uuid not null,
          created_at timestamptz not null default now(),
          expires_at timestamptz not null,
          accepted_by uuid,
          accepted_at timestamptz
        );
        """;
}
