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
    private readonly Guid destinationAccountId = Guid.NewGuid();
    private readonly Guid categoryId = Guid.NewGuid();
    private readonly Guid expenseCategoryId = Guid.NewGuid();

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
            insert into public.accounts (id, household_id, name, kind, currency, created_by)
            values (@destination_account_id, @household_id, 'Savings', 'savings', 'BRL', @actor_user_id);
            insert into public.categories (id, household_id, name, flow, created_by)
            values (@category_id, @household_id, 'Salary', 'income', @actor_user_id);
            insert into public.categories (id, household_id, name, flow, created_by)
            values (@expense_category_id, @household_id, 'Food', 'expense', @actor_user_id);
            """;
        seed.Parameters.AddWithValue("household_id", householdId);
        seed.Parameters.AddWithValue("actor_user_id", actorUserId);
        seed.Parameters.AddWithValue("account_id", accountId);
        seed.Parameters.AddWithValue("destination_account_id", destinationAccountId);
        seed.Parameters.AddWithValue("category_id", categoryId);
        seed.Parameters.AddWithValue("expense_category_id", expenseCategoryId);
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
        Assert.Equal(1_000, balances.Single(item => item.AccountId == accountId).BalanceCents);
        Assert.True(reconciliation.IsConsistent);
        Assert.Equal(1, reconciliation.PostedTransactionCount);
        Assert.Equal(1, reconciliation.EntryTransactionCount);
    }

    [Fact]
    public async Task ReusingKeyWithDifferentPayloadReturnsConflictWithoutDuplicatingMovement()
    {
        var idempotencyKey = Guid.NewGuid();
        var original = await PostIncomeAsync(idempotencyKey, 1_000, "Salary");

        var exception = await Assert.ThrowsAsync<FinancialRuleException>(() =>
            PostIncomeAsync(idempotencyKey, 2_000, "Bonus"));

        Assert.Equal("idempotency_conflict", exception.Code);
        await using var context = CreateContext();
        var store = new EfLedgerStore(context);
        var balances = await store.GetBalancesAsync(householdId, CancellationToken.None);
        var history = await store.GetHistoryAsync(householdId, 100, CancellationToken.None);
        Assert.Equal(1_000, balances.Single(item => item.AccountId == accountId).BalanceCents);
        Assert.All(history, item => Assert.Equal(original.TransactionId, item.TransactionId));
    }

    [Fact]
    public async Task ZeroBalanceAccountCreationCanBeSafelyRetried()
    {
        var createdAccountId = Guid.NewGuid();
        var idempotencyKey = Guid.NewGuid();

        async Task<AccountCreationResult> CreateAsync(string name)
        {
            await using var context = CreateContext();
            return await new LedgerService(new EfLedgerStore(context)).CreateAccountAsync(
                actorUserId,
                new CreateAccountCommand(
                    createdAccountId,
                    householdId,
                    name,
                    AccountKind.Savings,
                    "BRL",
                    0,
                    new DateOnly(2026, 9, 16),
                    idempotencyKey),
                CancellationToken.None);
        }

        var created = await CreateAsync("Emergency fund");
        var replayed = await CreateAsync("Emergency fund");
        var conflict = await Assert.ThrowsAsync<FinancialRuleException>(() => CreateAsync("Other account"));

        Assert.False(created.Replayed);
        Assert.True(replayed.Replayed);
        Assert.Equal(created.Account.Id, replayed.Account.Id);
        Assert.Equal("idempotency_conflict", conflict.Code);
    }

    [Fact]
    public async Task IncomeAndExpenseUpdateOnlyTheSelectedAccount()
    {
        await PostIncomeAsync(Guid.NewGuid(), 10_000, "Salary");
        await using (var context = CreateContext())
        {
            var service = new LedgerService(new EfLedgerStore(context));
            await service.PostExpenseAsync(
                actorUserId,
                new PostExpenseCommand(
                    householdId,
                    accountId,
                    expenseCategoryId,
                    2_500,
                    "BRL",
                    new DateOnly(2026, 9, 16),
                    Guid.NewGuid(),
                    "Groceries"),
                CancellationToken.None);
        }

        await using var verification = CreateContext();
        var store = new EfLedgerStore(verification);
        var balances = await store.GetBalancesAsync(householdId, CancellationToken.None);
        var history = await store.GetHistoryAsync(householdId, 100, CancellationToken.None);

        Assert.Equal(7_500, balances.Single(item => item.AccountId == accountId).BalanceCents);
        Assert.Equal(0, balances.Single(item => item.AccountId == destinationAccountId).BalanceCents);
        Assert.Contains(history, item => item.Kind == FinancialTransactionKind.Income && item.AmountCents == 10_000);
        Assert.Contains(history, item => item.Kind == FinancialTransactionKind.Expense && item.AmountCents == 2_500);
    }

    [Fact]
    public async Task InvalidAmountAndCrossFlowCategoryAreRejectedWithoutChangingBalance()
    {
        await using (var context = CreateContext())
        {
            var service = new LedgerService(new EfLedgerStore(context));
            var invalidAmount = await Assert.ThrowsAsync<FinancialRuleException>(() =>
                service.PostIncomeAsync(
                    actorUserId,
                    new PostIncomeCommand(
                        householdId,
                        accountId,
                        categoryId,
                        0,
                        "BRL",
                        new DateOnly(2026, 9, 16),
                        Guid.NewGuid(),
                        null),
                    CancellationToken.None));
            Assert.Equal("invalid_amount", invalidAmount.Code);
        }

        await using (var context = CreateContext())
        {
            var service = new LedgerService(new EfLedgerStore(context));
            var mismatch = await Assert.ThrowsAsync<FinancialRuleException>(() =>
                service.PostExpenseAsync(
                    actorUserId,
                    new PostExpenseCommand(
                        householdId,
                        accountId,
                        categoryId,
                        500,
                        "BRL",
                        new DateOnly(2026, 9, 16),
                        Guid.NewGuid(),
                        null),
                    CancellationToken.None));
            Assert.Equal("invalid_category", mismatch.Code);
        }

        await using var verification = CreateContext();
        var balances = await new EfLedgerStore(verification)
            .GetBalancesAsync(householdId, CancellationToken.None);
        Assert.All(balances, balance => Assert.Equal(0, balance.BalanceCents));
    }

    [Fact]
    public async Task AccountLifecycleKeepsDerivedBalanceAndHistoryAfterArchive()
    {
        var createdAccountId = Guid.NewGuid();
        var idempotencyKey = Guid.NewGuid();
        await using (var context = CreateContext())
        {
            var service = new LedgerService(new EfLedgerStore(context));
            var created = await service.CreateAccountAsync(
                actorUserId,
                new CreateAccountCommand(
                    createdAccountId,
                    householdId,
                    "Reserva",
                    AccountKind.Savings,
                    "BRL",
                    25_000,
                    new DateOnly(2026, 9, 15),
                    idempotencyKey),
                CancellationToken.None);

            Assert.False(created.Replayed);
            Assert.Equal(25_000, created.Account.BalanceCents);
        }

        await using (var context = CreateContext())
        {
            var service = new LedgerService(new EfLedgerStore(context));
            var replay = await service.CreateAccountAsync(
                actorUserId,
                new CreateAccountCommand(
                    createdAccountId,
                    householdId,
                    "Reserva",
                    AccountKind.Savings,
                    "BRL",
                    25_000,
                    new DateOnly(2026, 9, 15),
                    idempotencyKey),
                CancellationToken.None);
            Assert.True(replay.Replayed);

            await service.ArchiveAccountAsync(
                householdId,
                createdAccountId,
                actorUserId,
                CancellationToken.None);
        }

        await using (var context = CreateContext())
        {
            var service = new LedgerService(new EfLedgerStore(context));
            var active = await service.GetAccountsAsync(householdId, false, CancellationToken.None);
            var all = await service.GetAccountsAsync(householdId, true, CancellationToken.None);
            var history = await service.GetHistoryAsync(householdId, 100, CancellationToken.None);

            Assert.DoesNotContain(active, item => item.Id == createdAccountId);
            Assert.NotNull(Assert.Single(all, item => item.Id == createdAccountId).ArchivedAt);
            var opening = Assert.Single(history, item => item.AccountId == createdAccountId);
            Assert.Equal(FinancialTransactionKind.OpeningBalance, opening.Kind);
            Assert.Equal(actorUserId, opening.CreatedBy);
            Assert.Equal(new DateOnly(2026, 9, 15), opening.OccurredOn);
            Assert.Equal(25_000, opening.AmountCents);
        }
    }

    [Fact]
    public async Task TransferMovesValueAtomicallyWithoutChangingConsolidatedBalance()
    {
        await PostIncomeAsync(Guid.NewGuid());

        LedgerWriteResult result;
        await using (var context = CreateContext())
        {
            var service = new LedgerService(new EfLedgerStore(context));
            result = await service.PostTransferAsync(
                actorUserId,
                new PostTransferCommand(
                    householdId,
                    accountId,
                    destinationAccountId,
                    400,
                    "BRL",
                    new DateOnly(2026, 9, 15),
                    Guid.NewGuid(),
                    "Reserva mensal"),
                CancellationToken.None);
        }

        await using (var context = CreateContext())
        {
            var store = new EfLedgerStore(context);
            var balances = await store.GetBalancesAsync(householdId, CancellationToken.None);
            var transferEntries = (await store.GetHistoryAsync(
                    householdId,
                    100,
                    CancellationToken.None))
                .Where(entry => entry.TransactionId == result.TransactionId)
                .ToArray();

            Assert.Equal(600, balances.Single(item => item.AccountId == accountId).BalanceCents);
            Assert.Equal(400, balances.Single(item => item.AccountId == destinationAccountId).BalanceCents);
            Assert.Equal(1_000, balances.Sum(item => item.BalanceCents));
            Assert.Equal(2, transferEntries.Length);
            Assert.Equal(400, transferEntries.Single(item => item.Direction == EntryDirection.Debit).AmountCents);
            Assert.Equal(400, transferEntries.Single(item => item.Direction == EntryDirection.Credit).AmountCents);
        }
    }

    [Fact]
    public async Task InvalidTransferLeavesNoTransactionEntriesOrPartialBalance()
    {
        await PostIncomeAsync(Guid.NewGuid());
        var foreignHouseholdId = Guid.NewGuid();
        var foreignAccountId = Guid.NewGuid();

        await using (var context = CreateContext())
        {
            await context.Database.ExecuteSqlInterpolatedAsync($"""
                insert into public.households (id, name, created_by)
                values ({foreignHouseholdId}, 'Foreign household', {actorUserId});
                insert into public.accounts (id, household_id, name, kind, currency, created_by)
                values ({foreignAccountId}, {foreignHouseholdId}, 'Foreign account', 'checking', 'BRL', {actorUserId});
                """);
        }

        await using (var context = CreateContext())
        {
            var service = new LedgerService(new EfLedgerStore(context));
            var exception = await Assert.ThrowsAsync<FinancialRuleException>(() =>
                service.PostTransferAsync(
                    actorUserId,
                    new PostTransferCommand(
                        householdId,
                        accountId,
                        foreignAccountId,
                        400,
                        "BRL",
                        new DateOnly(2026, 9, 15),
                        Guid.NewGuid(),
                        null),
                    CancellationToken.None));

            Assert.Equal("invalid_account", exception.Code);
        }

        await using (var context = CreateContext())
        {
            var balances = await new EfLedgerStore(context)
                .GetBalancesAsync(householdId, CancellationToken.None);
            var reconciliation = await new EfLedgerStore(context)
                .ReconcileAsync(householdId, CancellationToken.None);

            Assert.Equal(1_000, balances.Single(item => item.AccountId == accountId).BalanceCents);
            Assert.Equal(0, balances.Single(item => item.AccountId == destinationAccountId).BalanceCents);
            Assert.True(reconciliation.IsConsistent);
            Assert.Equal(1, reconciliation.PostedTransactionCount);
            Assert.Equal(1, reconciliation.EntryTransactionCount);
        }
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
        Assert.Equal(0, balances.Single(item => item.AccountId == accountId).BalanceCents);
    }

    [Fact]
    public async Task ReversalAndRepostRemainVisibleAsAnAuditableCorrectionChain()
    {
        var original = await PostIncomeAsync(Guid.NewGuid(), 1_000, "Valor incorreto");
        var reversal = await ReverseAsync(original.TransactionId, Guid.NewGuid());
        var repost = await PostIncomeAsync(Guid.NewGuid(), 750, "Valor corrigido");

        await using var context = CreateContext();
        var store = new EfLedgerStore(context);
        var history = await store.GetHistoryAsync(householdId, 100, CancellationToken.None);
        var balance = await store.GetBalancesAsync(householdId, CancellationToken.None);

        var originalItem = Assert.Single(history, item => item.TransactionId == original.TransactionId);
        var reversalItem = Assert.Single(history, item => item.TransactionId == reversal.TransactionId);
        var repostItem = Assert.Single(history, item => item.TransactionId == repost.TransactionId);

        Assert.Equal(FinancialTransactionStatus.Reversed, originalItem.Status);
        Assert.Null(originalItem.ReversalOf);
        Assert.Equal(EntryDirection.Credit, originalItem.Direction);
        Assert.Equal(1_000, originalItem.AmountCents);

        Assert.Equal(FinancialTransactionKind.Reversal, reversalItem.Kind);
        Assert.Equal(original.TransactionId, reversalItem.ReversalOf);
        Assert.Equal(EntryDirection.Debit, reversalItem.Direction);
        Assert.Equal(originalItem.AmountCents, reversalItem.AmountCents);

        Assert.Equal(FinancialTransactionKind.Income, repostItem.Kind);
        Assert.Equal(FinancialTransactionStatus.Posted, repostItem.Status);
        Assert.Null(repostItem.ReversalOf);
        Assert.Equal(750, repostItem.AmountCents);
        Assert.Equal(750, balance.Single(item => item.AccountId == accountId).BalanceCents);
    }

    private async Task<LedgerWriteResult> PostIncomeAsync(
        Guid idempotencyKey,
        long amountCents = 1_000,
        string description = "Salary")
    {
        await using var context = CreateContext();
        var service = new LedgerService(new EfLedgerStore(context));
        return await service.PostIncomeAsync(
            actorUserId,
            new PostIncomeCommand(
                householdId,
                accountId,
                categoryId,
                amountCents,
                "BRL",
                new DateOnly(2026, 9, 14),
                idempotencyKey,
                description),
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
          idempotency_key uuid,
          created_by uuid not null,
          created_at timestamptz not null default now(),
          archived_at timestamptz,
          unique (household_id, id),
          unique (household_id, idempotency_key)
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
