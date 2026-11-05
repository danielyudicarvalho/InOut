using InOut.Application.Financial;
using InOut.Application.Financial.Forecasts;
using InOut.Application.Financial.RecurringPlans;
using InOut.Application.Financial.Dashboard;
using InOut.Application.Idempotency;
using InOut.Application.Households;
using InOut.Domain.Financial;
using InOut.Domain.Households;
using InOut.Infrastructure.Financial;
using InOut.Infrastructure.Households;
using InOut.Infrastructure.Idempotency;
using InOut.Infrastructure.Persistence;
using InOut.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
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
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root is not null && !Directory.Exists(Path.Combine(root.FullName, "supabase", "migrations"))) root = root.Parent;
        var migration = Directory.GetFiles(Path.Combine(root!.FullName, "supabase", "migrations"), "*_planning_currencies.sql").Single();
        command.CommandText = await File.ReadAllTextAsync(migration);
        await command.ExecuteNonQueryAsync();

        await using var seed = connection.CreateCommand();
        seed.CommandText = """
            insert into public.households (id, name, created_by)
            values (@household_id, 'Integration household', @actor_user_id);
            insert into public.household_members (household_id, user_id, role)
            values (@household_id, @actor_user_id, 'owner');
            insert into public.accounts (id, household_id, name, kind, currency, created_by)
            values (@account_id, @household_id, 'Checking', 'checking', 'BRL', @actor_user_id);
            insert into public.accounts (id, household_id, name, kind, currency, created_by)
            values (@destination_account_id, @household_id, 'Savings', 'savings', 'BRL', @actor_user_id);
            insert into public.categories (id, household_id, name, flow, created_by)
            values (@category_id, @household_id, 'Salary', 'income', @actor_user_id);
            insert into public.categories (id, household_id, name, flow, created_by)
            values (@expense_category_id, @household_id, 'Food', 'expense', @actor_user_id);
            insert into public.budgets (
              id, household_id, category_id, period_start, period_end, limit_cents, created_by, currency)
            values (
              gen_random_uuid(), @household_id, @expense_category_id,
              '2026-09-01', '2026-09-30', 500, @actor_user_id, 'BRL');
            insert into public.goals (
              id, household_id, name, target_cents, allocated_cents, target_date, currency, created_by)
            values (
              gen_random_uuid(), @household_id, 'Emergency fund', 10000, 2500, '2026-12-31', 'BRL', @actor_user_id);
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
    public async Task NewlyRegisteredUserWithNoHouseholdGetsAnEmptyList()
    {
        await using var context = CreateContext();
        var store = new EfHouseholdStore(context, NullLogger<EfHouseholdStore>.Instance);

        var households = await store.ListAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.Empty(households);
    }

    [Fact]
    public async Task CollaborationProtectsLastOwnerAndPreservesHistoricalAuthorshipAfterLeave()
    {
        var transaction = await PostIncomeAsync(Guid.NewGuid());
        await using var context = CreateContext();
        var store = new EfHouseholdStore(context, NullLogger<EfHouseholdStore>.Instance);
        var service = new HouseholdService(store, TimeProvider.System);
        await Assert.ThrowsAsync<HouseholdRuleException>(() => service.RemoveMemberAsync(actorUserId, householdId, actorUserId, CancellationToken.None));
        await Assert.ThrowsAsync<HouseholdRuleException>(() => service.CreateInvitationAsync(Guid.NewGuid(), householdId, CancellationToken.None));
        var invite = await service.CreateInvitationAsync(actorUserId, householdId, CancellationToken.None);
        var secondUser = Guid.NewGuid();
        await service.AcceptInvitationAsync(secondUser, invite.Code, CancellationToken.None);
        var replay = await service.AcceptInvitationAsync(secondUser, invite.Code, CancellationToken.None);
        Assert.Equal(householdId, replay.Id);
        await Assert.ThrowsAsync<HouseholdRuleException>(() => service.ChangeRoleAsync(secondUser, householdId, secondUser, HouseholdRole.Owner, CancellationToken.None));
        await service.ChangeRoleAsync(actorUserId, householdId, secondUser, HouseholdRole.Owner, CancellationToken.None);
        await service.RemoveMemberAsync(actorUserId, householdId, actorUserId, CancellationToken.None);
        await Assert.ThrowsAsync<HouseholdRuleException>(() => service.GetContextAsync(actorUserId, householdId, CancellationToken.None));
        var remaining = await service.GetContextAsync(secondUser, householdId, CancellationToken.None);
        Assert.Equal(HouseholdRole.Owner, Assert.Single(remaining.Members).Role);
        var historical = await CreateStore(context).GetHistoryAsync(secondUser, householdId, 50,
            new LedgerHistoryFilter(TransactionId: transaction.TransactionId), CancellationToken.None);
        Assert.NotEmpty(historical);
        Assert.All(historical, row => Assert.Equal(actorUserId, row.CreatedBy));
    }

    [Fact]
    public async Task RevokedInvitationCannotBeAcceptedAndItsHashIsNotListed()
    {
        await using var context = CreateContext();
        var service = new HouseholdService(new EfHouseholdStore(context, NullLogger<EfHouseholdStore>.Instance), TimeProvider.System);
        var invite = await service.CreateInvitationAsync(actorUserId, householdId, CancellationToken.None);
        var row = Assert.Single(await service.ListInvitationsAsync(actorUserId, householdId, CancellationToken.None));
        await service.RevokeInvitationAsync(actorUserId, householdId, row.Id, CancellationToken.None);
        await Assert.ThrowsAsync<HouseholdRuleException>(() => service.AcceptInvitationAsync(Guid.NewGuid(), invite.Code, CancellationToken.None));
        Assert.NotNull(Assert.Single(await service.ListInvitationsAsync(actorUserId, householdId, CancellationToken.None)).RevokedAt);
    }

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
        var store = CreateStore(context);
        var balances = await store.GetBalancesAsync(actorUserId, householdId, CancellationToken.None);
        var reconciliation = await store.ReconcileAsync(actorUserId, householdId, CancellationToken.None);
        Assert.Equal(1_000, balances.Single(item => item.AccountId == accountId).BalanceCents);
        Assert.True(reconciliation.IsConsistent);
        Assert.Equal(1, reconciliation.PostedTransactionCount);
        Assert.Equal(1, reconciliation.EntryTransactionCount);
        Assert.Equal(1, await CountAsync("private.idempotency_requests"));
        Assert.Equal(1, await CountAsync("private.outbox_messages"));
    }

    [Fact]
    public async Task ReusingKeyWithDifferentPayloadReturnsConflictWithoutDuplicatingMovement()
    {
        var idempotencyKey = Guid.NewGuid();
        var original = await PostIncomeAsync(idempotencyKey, 1_000, "Salary");

        var exception = await Assert.ThrowsAsync<IdempotencyException>(() =>
            PostIncomeAsync(idempotencyKey, 2_000, "Bonus"));

        Assert.Equal("idempotency_conflict", exception.Code);
        await using var context = CreateContext();
        var store = CreateStore(context);
        var balances = await store.GetBalancesAsync(actorUserId, householdId, CancellationToken.None);
        var history = await store.GetHistoryAsync(actorUserId, householdId, 100, CancellationToken.None);
        Assert.Equal(1_000, balances.Single(item => item.AccountId == accountId).BalanceCents);
        Assert.All(history, item => Assert.Equal(original.TransactionId, item.TransactionId));
    }

    [Fact]
    public async Task ReusingKeyFromAnotherActorReturnsConflict()
    {
        var idempotencyKey = Guid.NewGuid();
        await PostIncomeAsync(idempotencyKey);

        var exception = await Assert.ThrowsAsync<IdempotencyException>(() =>
            PostIncomeAsync(idempotencyKey, actorId: Guid.NewGuid()));

        Assert.Equal("idempotency_conflict", exception.Code);
        Assert.Equal(1, await CountAsync("public.transactions"));
    }

    [Fact]
    public async Task ProcessingLeaseTimeoutAllowsSafeReclaimWithoutBusinessFailure()
    {
        var idempotencyKey = Guid.NewGuid();
        var transaction = FinancialTransaction.Income(
            householdId,
            accountId,
            categoryId,
            new Money(1_000, "BRL"),
            new DateOnly(2026, 9, 14),
            actorUserId,
            "Salary");

        var entries = string.Join(
            ';',
            transaction.Entries
                .OrderBy(entry => entry.AccountId)
                .ThenBy(entry => entry.CategoryId)
                .ThenBy(entry => entry.Direction)
                .Select(entry =>
                    $"{entry.AccountId:D},{entry.CategoryId?.ToString("D")},{entry.Direction},{entry.Amount.Cents},{entry.Amount.Currency}"));

        var request = IdempotencyRequest.Create(
            householdId,
            actorUserId,
            IdempotencyOperation.PostIncome,
            idempotencyKey,
            transaction.Kind,
            transaction.OccurredOn,
            transaction.Description,
            transaction.IncomeSourceId,
            entries);

        await using (var connection = new NpgsqlConnection(postgres.GetConnectionString()))
        {
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = """
                insert into private.idempotency_requests (
                    tenant_id, operation, idempotency_key, actor_user_id,
                    request_fingerprint, status, attempt_count, locked_until,
                    created_at, updated_at, expires_at)
                values (
                    @household_id, 'post_income', @key, @actor_user_id,
                    @fingerprint, 'processing', 1, now() - interval '1 minute',
                    now() - interval '5 minutes', now() - interval '5 minutes', now() + interval '90 days');
                """;
            command.Parameters.AddWithValue("household_id", householdId);
            command.Parameters.AddWithValue("key", idempotencyKey);
            command.Parameters.AddWithValue("actor_user_id", actorUserId);
            command.Parameters.AddWithValue("fingerprint", request.RequestFingerprint);
            await command.ExecuteNonQueryAsync();
        }

        var result = await PostIncomeAsync(idempotencyKey, 1_000);

        Assert.NotNull(result);
        Assert.False(result.Replayed);

        await using var context = CreateContext();
        var store = CreateStore(context);
        var balances = await store.GetBalancesAsync(actorUserId, householdId, CancellationToken.None);
        Assert.Equal(1_000, balances.Single(b => b.AccountId == accountId).BalanceCents);
    }

    [Fact]
    public async Task ZeroBalanceAccountCreationCanBeSafelyRetried()
    {
        var createdAccountId = Guid.NewGuid();
        var idempotencyKey = Guid.NewGuid();

        async Task<AccountCreationResult> CreateAsync(string name)
        {
            await using var context = CreateContext();
            return await new LedgerService(CreateStore(context)).CreateAccountAsync(
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
        var conflict = await Assert.ThrowsAsync<IdempotencyException>(() => CreateAsync("Other account"));

        Assert.False(created.Replayed);
        Assert.True(replayed.Replayed);
        Assert.Equal(created.Account.Id, replayed.Account.Id);
        Assert.Equal("idempotency_conflict", conflict.Code);
    }

    [Fact]
    public async Task DifferentKeysCannotCreateTheSameAccountIdentity()
    {
        var createdAccountId = Guid.NewGuid();

        async Task<AccountCreationResult> CreateAsync(Guid key)
        {
            await using var context = CreateContext();
            return await new LedgerService(CreateStore(context)).CreateAccountAsync(
                actorUserId,
                new CreateAccountCommand(
                    createdAccountId,
                    householdId,
                    "Emergency fund",
                    AccountKind.Savings,
                    "BRL",
                    0,
                    new DateOnly(2026, 9, 16),
                    key),
                CancellationToken.None);
        }

        await CreateAsync(Guid.NewGuid());
        var exception = await Assert.ThrowsAsync<FinancialRuleException>(() =>
            CreateAsync(Guid.NewGuid()));

        Assert.Equal("account_conflict", exception.Code);
        Assert.Equal(1, await CountAsync("public.accounts", "id", createdAccountId));
    }

    [Fact]
    public async Task CategoryCreationReplaysSameIntentAndRejectsChangedPayload()
    {
        var createdCategoryId = Guid.NewGuid();
        var idempotencyKey = Guid.NewGuid();

        async Task<CategorySummary> CreateAsync(string name)
        {
            await using var context = CreateContext();
            return await new LedgerService(CreateStore(context)).CreateCategoryAsync(
                householdId,
                actorUserId,
                createdCategoryId,
                name,
                FinancialFlow.Expense,
                null,
                idempotencyKey,
                CancellationToken.None);
        }

        var created = await CreateAsync("Transport");
        var replayed = await CreateAsync("Transport");
        var conflict = await Assert.ThrowsAsync<IdempotencyException>(() => CreateAsync("Fuel"));

        Assert.Equal(created, replayed);
        Assert.Equal("idempotency_conflict", conflict.Code);
        Assert.Equal(1, await CountAsync("public.categories", "id", createdCategoryId));
        Assert.Equal(1, await CountAsync("private.idempotency_requests", "resource_id", createdCategoryId));
        Assert.Equal(1, await CountAsync("private.outbox_messages", "aggregate_id", createdCategoryId));
    }

    [Fact]
    public async Task InboxProcessesTheSameMessageOnlyOnce()
    {
        var message = new InboxMessage(
            "balance_projection",
            Guid.NewGuid(),
            householdId,
            actorUserId,
            new string('a', 64));
        var executions = 0;

        await using (var context = CreateContext())
        {
            var processor = new EfInboxMessageProcessor(context, TimeProvider.System);
            Assert.True(await processor.ExecuteOnceAsync(
                message,
                _ =>
                {
                    executions += 1;
                    return Task.CompletedTask;
                },
                CancellationToken.None));
        }

        await using (var context = CreateContext())
        {
            var processor = new EfInboxMessageProcessor(context, TimeProvider.System);
            Assert.False(await processor.ExecuteOnceAsync(
                message,
                _ =>
                {
                    executions += 1;
                    return Task.CompletedTask;
                },
                CancellationToken.None));
        }

        Assert.Equal(1, executions);
    }

    [Fact]
    public async Task IncomeAndExpenseUpdateOnlyTheSelectedAccount()
    {
        await PostIncomeAsync(Guid.NewGuid(), 10_000, "Salary");
        await using (var context = CreateContext())
        {
            var service = new LedgerService(CreateStore(context));
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
        var store = CreateStore(verification);
        var balances = await store.GetBalancesAsync(actorUserId, householdId, CancellationToken.None);
        var history = await store.GetHistoryAsync(actorUserId, householdId, 100, CancellationToken.None);

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
            var service = new LedgerService(CreateStore(context));
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
            var service = new LedgerService(CreateStore(context));
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
        var balances = await CreateStore(verification)
            .GetBalancesAsync(actorUserId, householdId, CancellationToken.None);
        Assert.All(balances, balance => Assert.Equal(0, balance.BalanceCents));
    }

    [Fact]
    public async Task AccountLifecycleKeepsDerivedBalanceAndHistoryAfterArchive()
    {
        var createdAccountId = Guid.NewGuid();
        var idempotencyKey = Guid.NewGuid();
        await using (var context = CreateContext())
        {
            var service = new LedgerService(CreateStore(context));
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
            var service = new LedgerService(CreateStore(context));
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
            var service = new LedgerService(CreateStore(context));
            var active = await service.GetAccountsAsync(actorUserId, householdId, false, CancellationToken.None);
            var all = await service.GetAccountsAsync(actorUserId, householdId, true, CancellationToken.None);
            var history = await service.GetHistoryAsync(actorUserId, householdId, 100, CancellationToken.None);

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
    public async Task UpdateAccountMetadataUpdatesPermittedFieldsAndEnforcesUniquenessAndActiveStatus()
    {
        var targetAccountId = Guid.NewGuid();
        var secondAccountId = Guid.NewGuid();

        await using (var context = CreateContext())
        {
            var service = new LedgerService(CreateStore(context));
            await service.CreateAccountAsync(
                actorUserId,
                new CreateAccountCommand(
                    targetAccountId,
                    householdId,
                    "Conta Antiga",
                    AccountKind.Checking,
                    "BRL",
                    10_000,
                    new DateOnly(2026, 9, 15),
                    Guid.NewGuid()),
                CancellationToken.None);

            await service.CreateAccountAsync(
                actorUserId,
                new CreateAccountCommand(
                    secondAccountId,
                    householdId,
                    "Outra Conta",
                    AccountKind.Cash,
                    "BRL",
                    0,
                    new DateOnly(2026, 9, 15),
                    Guid.NewGuid()),
                CancellationToken.None);
        }

        await using (var context = CreateContext())
        {
            var service = new LedgerService(CreateStore(context));
            var updated = await service.UpdateAccountMetadataAsync(
                actorUserId,
                householdId,
                targetAccountId,
                "Conta Atualizada",
                AccountKind.Savings,
                CancellationToken.None);

            Assert.Equal("Conta Atualizada", updated.Name);
            Assert.Equal(AccountKind.Savings, updated.Kind);
            Assert.Equal("BRL", updated.Currency);
            Assert.Equal(10_000, updated.BalanceCents);
        }

        await using (var context = CreateContext())
        {
            var service = new LedgerService(CreateStore(context));
            var conflict = await Assert.ThrowsAsync<FinancialRuleException>(() =>
                service.UpdateAccountMetadataAsync(
                    actorUserId,
                    householdId,
                    targetAccountId,
                    "Outra Conta",
                    AccountKind.Investment,
                    CancellationToken.None));

            Assert.Equal(FinancialErrorCodes.AccountNameConflict, conflict.Code);
        }

        await using (var context = CreateContext())
        {
            var service = new LedgerService(CreateStore(context));
            await service.ArchiveAccountAsync(householdId, targetAccountId, actorUserId, CancellationToken.None);

            var archivedEx = await Assert.ThrowsAsync<FinancialRuleException>(() =>
                service.UpdateAccountMetadataAsync(
                    actorUserId,
                    householdId,
                    targetAccountId,
                    "Novo Nome",
                    AccountKind.Checking,
                    CancellationToken.None));

            Assert.Equal(FinancialErrorCodes.AccountArchived, archivedEx.Code);
        }
    }

    [Fact]
    public async Task TransferMovesValueAtomicallyWithoutChangingConsolidatedBalance()
    {
        await PostIncomeAsync(Guid.NewGuid());

        LedgerWriteResult result;
        await using (var context = CreateContext())
        {
            var service = new LedgerService(CreateStore(context));
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
            var store = CreateStore(context);
            var balances = await store.GetBalancesAsync(actorUserId, householdId, CancellationToken.None);
            var transferEntries = (await store.GetHistoryAsync(
                    actorUserId,
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
            var service = new LedgerService(CreateStore(context));
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
            var balances = await CreateStore(context)
                .GetBalancesAsync(actorUserId, householdId, CancellationToken.None);
            var reconciliation = await CreateStore(context)
                .ReconcileAsync(actorUserId, householdId, CancellationToken.None);

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
        var balances = await CreateStore(context)
            .GetBalancesAsync(actorUserId, householdId, CancellationToken.None);
        Assert.Equal(0, balances.Single(item => item.AccountId == accountId).BalanceCents);
    }

    [Fact]
    public async Task ReversalAndRepostRemainVisibleAsAnAuditableCorrectionChain()
    {
        var original = await PostIncomeAsync(Guid.NewGuid(), 1_000, "Valor incorreto");
        var reversal = await ReverseAsync(original.TransactionId, Guid.NewGuid());
        var repost = await PostIncomeAsync(Guid.NewGuid(), 750, "Valor corrigido");

        await using var context = CreateContext();
        var store = CreateStore(context);
        var history = await store.GetHistoryAsync(actorUserId, householdId, 100, CancellationToken.None);
        var balance = await store.GetBalancesAsync(actorUserId, householdId, CancellationToken.None);

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

    [Fact]
    public async Task ReleaseJourneyReconcilesKnownBalancesAfterExpenseTransferAndCorrection()
    {
        await PostIncomeAsync(Guid.NewGuid(), 10_000);

        LedgerWriteResult expense;
        await using (var context = CreateContext())
        {
            var service = new LedgerService(CreateStore(context));
            expense = await service.PostExpenseAsync(actorUserId,
                new PostExpenseCommand(householdId, accountId, expenseCategoryId,
                    2_500, "BRL", new DateOnly(2026, 9, 16), Guid.NewGuid(), null),
                CancellationToken.None);
            await service.PostTransferAsync(actorUserId,
                new PostTransferCommand(householdId, accountId, destinationAccountId,
                    1_000, "BRL", new DateOnly(2026, 9, 16), Guid.NewGuid(), null),
                CancellationToken.None);
        }

        var reversal = await ReverseAsync(expense.TransactionId, Guid.NewGuid());
        await using (var context = CreateContext())
        {
            await new LedgerService(CreateStore(context)).PostExpenseAsync(actorUserId,
                new PostExpenseCommand(householdId, accountId, expenseCategoryId,
                    2_000, "BRL", new DateOnly(2026, 9, 16), Guid.NewGuid(), null),
                CancellationToken.None);
        }

        await using var verification = CreateContext();
        var store = CreateStore(verification);
        var balances = await store.GetBalancesAsync(actorUserId, householdId, CancellationToken.None);
        var reconciliation = await store.ReconcileAsync(actorUserId, householdId, CancellationToken.None);
        var history = await store.GetHistoryAsync(actorUserId, householdId, 100, CancellationToken.None);

        Assert.Equal(7_000, balances.Single(item => item.AccountId == accountId).BalanceCents);
        Assert.Equal(1_000, balances.Single(item => item.AccountId == destinationAccountId).BalanceCents);
        Assert.Equal(8_000, balances.Sum(item => item.BalanceCents));
        Assert.True(reconciliation.IsConsistent);
        Assert.Equal(FinancialTransactionStatus.Reversed,
            history.First(item => item.TransactionId == expense.TransactionId).Status);
        Assert.Equal(expense.TransactionId,
            history.First(item => item.TransactionId == reversal.TransactionId).ReversalOf);
    }

    [Fact]
    public async Task CategoriesRequireActiveMatchingRootAndPreserveArchivedHistory()
    {
        var rootId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        await using (var context = CreateContext())
        {
            var service = new LedgerService(CreateStore(context));
            await service.CreateCategoryAsync(householdId, actorUserId, rootId,
                "  Extras  ", FinancialFlow.Expense, null, Guid.NewGuid(), CancellationToken.None);
            await service.CreateCategoryAsync(householdId, actorUserId, childId,
                "Cinema", FinancialFlow.Expense, rootId, Guid.NewGuid(), CancellationToken.None);
            await Assert.ThrowsAsync<FinancialRuleException>(() => service.CreateCategoryAsync(
                householdId, actorUserId, Guid.NewGuid(), "Invalid", FinancialFlow.Income,
                rootId, Guid.NewGuid(), CancellationToken.None));
            await Assert.ThrowsAsync<FinancialRuleException>(() => service.ArchiveCategoryAsync(
                householdId, rootId, actorUserId, CancellationToken.None));
        }

        await using (var context = CreateContext())
        {
            var service = new LedgerService(CreateStore(context));
            await service.PostExpenseAsync(actorUserId,
                new PostExpenseCommand(householdId, accountId, childId, 100,
                    "BRL", new DateOnly(2026, 9, 20), Guid.NewGuid(), "Movie"),
                CancellationToken.None);
            await service.ArchiveCategoryAsync(householdId, childId, actorUserId, CancellationToken.None);
            await service.ArchiveCategoryAsync(householdId, rootId, actorUserId, CancellationToken.None);

            Assert.DoesNotContain(await service.GetCategoriesAsync(actorUserId, householdId, FinancialFlow.Expense,
                false, CancellationToken.None), item => item.Id == childId);
            var archived = await service.GetCategoriesAsync(actorUserId, householdId, FinancialFlow.Expense,
                true, CancellationToken.None);
            Assert.Equal(rootId, Assert.Single(archived, item => item.Id == childId).ParentId);
            var history = await service.GetHistoryAsync(actorUserId, householdId, 100,
                new LedgerHistoryFilter(CategoryId: childId, Kind: FinancialTransactionKind.Expense),
                CancellationToken.None);
            Assert.Equal("Cinema", Assert.Single(history).CategoryName);

            // Re-archiving is a no-op
            await service.ArchiveCategoryAsync(householdId, childId, actorUserId, CancellationToken.None);

            // New posting with archived category is rejected
            var invalidPosting = await Assert.ThrowsAsync<FinancialRuleException>(() =>
                service.PostExpenseAsync(actorUserId,
                    new PostExpenseCommand(householdId, accountId, childId, 50,
                        "BRL", new DateOnly(2026, 9, 21), Guid.NewGuid(), "New Movie"),
                    CancellationToken.None));
            Assert.Equal(FinancialErrorCodes.InvalidCategory, invalidPosting.Code);
        }
    }

    [Fact]
    public async Task SubcategoryCannotBeParentEnforcesSingleHierarchyDepth()
    {
        var rootId = Guid.NewGuid();
        var subcategoryId = Guid.NewGuid();
        var grandchildId = Guid.NewGuid();

        await using (var context = CreateContext())
        {
            var service = new LedgerService(CreateStore(context));
            await service.CreateCategoryAsync(householdId, actorUserId, rootId,
                "Alimentação", FinancialFlow.Expense, null, Guid.NewGuid(), CancellationToken.None);
            await service.CreateCategoryAsync(householdId, actorUserId, subcategoryId,
                "Restaurante", FinancialFlow.Expense, rootId, Guid.NewGuid(), CancellationToken.None);

            var ex = await Assert.ThrowsAsync<FinancialRuleException>(() => service.CreateCategoryAsync(
                householdId, actorUserId, grandchildId,
                "Japonês", FinancialFlow.Expense, subcategoryId, Guid.NewGuid(), CancellationToken.None));

            Assert.Equal(FinancialErrorCodes.InvalidCategory, ex.Code);
        }
    }

    [Fact]
    public async Task HistoryFiltersBeforeLimitAndKeepsUnclassifiedTransfers()
    {
        await PostIncomeAsync(Guid.NewGuid());
        await using (var context = CreateContext())
        {
            var service = new LedgerService(CreateStore(context));
            await service.PostTransferAsync(actorUserId,
                new PostTransferCommand(householdId, accountId, destinationAccountId,
                    100, "BRL", new DateOnly(2026, 9, 15), Guid.NewGuid(), null),
                CancellationToken.None);
            var filtered = await service.GetHistoryAsync(actorUserId, householdId, 1,
                new LedgerHistoryFilter(From: new DateOnly(2026, 9, 14),
                    To: new DateOnly(2026, 9, 14), CategoryId: categoryId), CancellationToken.None);
            Assert.Equal(FinancialTransactionKind.Income, Assert.Single(filtered).Kind);
            var transfer = await service.GetHistoryAsync(actorUserId, householdId, 10,
                new LedgerHistoryFilter(Kind: FinancialTransactionKind.Transfer), CancellationToken.None);
            Assert.Equal(2, transfer.Count);
            Assert.All(transfer, item => Assert.Null(item.CategoryId));
            var secondLeg = await service.GetHistoryAsync(actorUserId, householdId, 1,
                new LedgerHistoryFilter(Kind: FinancialTransactionKind.Transfer, Offset: 1), CancellationToken.None);
            Assert.Equal(transfer[1], Assert.Single(secondLeg));
            var exhausted = await service.GetHistoryAsync(actorUserId, householdId, 1,
                new LedgerHistoryFilter(Kind: FinancialTransactionKind.Transfer, Offset: 2), CancellationToken.None);
            Assert.Empty(exhausted);
        }
    }

    [Fact]
    public async Task DashboardUsesLedgerAndExcludesInternalTransfersFromResult()
    {
        await PostIncomeAsync(Guid.NewGuid(), 1_000);
        await using (var context = CreateContext())
        {
            var service = new LedgerService(CreateStore(context));
            await service.PostExpenseAsync(actorUserId,
                new PostExpenseCommand(householdId, accountId, expenseCategoryId,
                    250, "BRL", new DateOnly(2026, 9, 16), Guid.NewGuid(), "Food"),
                CancellationToken.None);
            await service.PostTransferAsync(actorUserId,
                new PostTransferCommand(householdId, accountId, destinationAccountId,
                    100, "BRL", new DateOnly(2026, 9, 17), Guid.NewGuid(), "Reserve"),
                CancellationToken.None);
        }

        await using var queryContext = CreateContext();
        var dashboard = await CreateDashboardUseCase(queryContext).ExecuteAsync(
            new GetFinancialDashboardQuery(actorUserId, householdId, 2026, 9),
            CancellationToken.None);

        var summary = Assert.Single(dashboard.Summaries);
        Assert.True(dashboard.IsReconciled);
        Assert.Equal(750, summary.ConsolidatedBalanceCents);
        Assert.Equal(1_000, summary.IncomeCents);
        Assert.Equal(250, summary.ExpenseCents);
        Assert.Equal(750, summary.ResultCents);
        Assert.Equal(2, dashboard.Accounts.Count);
        Assert.Equal(250, Assert.Single(dashboard.CategoryExpenses).AmountCents);
        Assert.Equal(250, Assert.Single(dashboard.Budgets).SpentCents);
        Assert.Equal(2_500, Assert.Single(dashboard.Goals).AllocatedCents);
    }

    [Fact]
    public async Task SetBudgetSucceedsUpsertsLimitAndCalculatesDashboardProgress()
    {
        var periodStart = new DateOnly(2026, 9, 1);
        var periodEnd = new DateOnly(2026, 9, 30);
        var initialLimit = 150_000L;
        var updatedLimit = 200_000L;

        await using (var context = CreateContext())
        {
            var service = new LedgerService(CreateStore(context));
            var result = await service.SetBudgetAsync(
                actorUserId,
                new SetBudgetCommand(null, householdId, expenseCategoryId, periodStart, periodEnd, initialLimit, Guid.NewGuid(), "BRL"),
                CancellationToken.None);

            Assert.Equal(expenseCategoryId, result.CategoryId);
            Assert.Equal(initialLimit, result.LimitCents);
            Assert.False(result.Replayed);
        }

        await PostIncomeAsync(Guid.NewGuid(), 500_000);
        await using (var context = CreateContext())
        {
            var service = new LedgerService(CreateStore(context));
            await service.PostExpenseAsync(
                actorUserId,
                new PostExpenseCommand(householdId, accountId, expenseCategoryId, 50_000, "BRL", new DateOnly(2026, 9, 15), Guid.NewGuid(), "Supermarket"),
                CancellationToken.None);
        }

        await using (var context = CreateContext())
        {
            var dashboard = await CreateDashboardUseCase(context).ExecuteAsync(
                new GetFinancialDashboardQuery(actorUserId, householdId, 2026, 9),
                CancellationToken.None);

            var budgetProgress = Assert.Single(dashboard.Budgets);
            Assert.Equal(expenseCategoryId, budgetProgress.CategoryId);
            Assert.Equal(initialLimit, budgetProgress.LimitCents);
            Assert.Equal(50_000L, budgetProgress.SpentCents);
        }

        await using (var context = CreateContext())
        {
            var service = new LedgerService(CreateStore(context));
            var updatedResult = await service.SetBudgetAsync(
                actorUserId,
                new SetBudgetCommand(null, householdId, expenseCategoryId, periodStart, periodEnd, updatedLimit, Guid.NewGuid(), "BRL"),
                CancellationToken.None);

            Assert.Equal(updatedLimit, updatedResult.LimitCents);
        }

        await using (var context = CreateContext())
        {
            var dashboard = await CreateDashboardUseCase(context).ExecuteAsync(
                new GetFinancialDashboardQuery(actorUserId, householdId, 2026, 9),
                CancellationToken.None);

            var budgetProgress = Assert.Single(dashboard.Budgets);
            Assert.Equal(updatedLimit, budgetProgress.LimitCents);
            Assert.Equal(50_000L, budgetProgress.SpentCents);
        }
    }

    [Fact]
    public async Task BudgetsInDifferentCurrenciesCoexistAndCannotReplayOrReinterpretAnotherCurrency()
    {
        await using var context = CreateContext();
        var service = new LedgerService(CreateStore(context));
        var usdAccount = Guid.NewGuid();
        await service.CreateAccountAsync(actorUserId, new CreateAccountCommand(usdAccount, householdId,
            "Dollar account", AccountKind.Checking, "USD", 1000, new DateOnly(2026, 9, 1), Guid.NewGuid()), CancellationToken.None);
        await service.PostExpenseAsync(actorUserId, new PostExpenseCommand(householdId, usdAccount,
            expenseCategoryId, 200, "USD", new DateOnly(2026, 9, 2), Guid.NewGuid(), null), CancellationToken.None);
        var command = new SetBudgetCommand(null, householdId, expenseCategoryId, new DateOnly(2026, 9, 1),
            new DateOnly(2026, 9, 30), 500, Guid.NewGuid(), "USD");
        var usd = await service.SetBudgetAsync(actorUserId, command, CancellationToken.None);
        Assert.Equal("USD", usd.Currency);
        var replay = await service.SetBudgetAsync(actorUserId, command with { Currency = "usd" }, CancellationToken.None);
        Assert.True(replay.Replayed);
        var conflict = await Assert.ThrowsAsync<IdempotencyException>(() => service.SetBudgetAsync(actorUserId,
            command with { Currency = "BRL" }, CancellationToken.None));
        Assert.Equal(IdempotencyErrorCodes.Conflict, conflict.Code);
        await Assert.ThrowsAsync<FinancialRuleException>(() => service.SetBudgetAsync(actorUserId,
            command with { Id = usd.Id, Currency = "BRL", IdempotencyKey = Guid.NewGuid() }, CancellationToken.None));
        var dashboard = await CreateDashboardUseCase(context).ExecuteAsync(
            new GetFinancialDashboardQuery(actorUserId, householdId, 2026, 9), CancellationToken.None);
        Assert.Equal(0L, dashboard.Budgets.Single(b => b.Currency == "BRL").SpentCents);
        Assert.Equal(200L, dashboard.Budgets.Single(b => b.Currency == "USD").SpentCents);
    }

    [Fact]
    public async Task SetBudgetRejectsNonExpenseCategory()
    {
        var periodStart = new DateOnly(2026, 9, 1);
        var periodEnd = new DateOnly(2026, 9, 30);

        await using var context = CreateContext();
        var service = new LedgerService(CreateStore(context));

        var ex = await Assert.ThrowsAsync<FinancialRuleException>(() =>
            service.SetBudgetAsync(
                actorUserId,
                new SetBudgetCommand(null, householdId, categoryId, periodStart, periodEnd, 100_000, Guid.NewGuid(), "BRL"),
                CancellationToken.None));

        Assert.Equal(FinancialErrorCodes.InvalidCategory, ex.Code);
    }

    [Fact]
    public async Task GoalAllocationHistoryExplainsProgressAndReversalKeepsTheOriginal()
    {
        var goalId = Guid.NewGuid();
        await ExecuteAsync("""
            insert into public.goals (
              id, household_id, name, target_cents, allocated_cents, currency, created_by)
            values (@goal_id, @household_id, 'Trip', 10000, 0, 'BRL', @actor_user_id)
            """, ("goal_id", goalId));
        try
        {
            await using var context = CreateContext();
            var service = new LedgerService(CreateStore(context));
            var unexplainedId = await ScalarAsync<Guid>("""
                select id from public.goals
                where household_id = @household_id and name = 'Emergency fund'
                """);
            var unexplained = await Assert.ThrowsAsync<FinancialRuleException>(() =>
                service.AllocateToGoalAsync(actorUserId, new AllocateGoalCommand(
                    householdId, unexplainedId, 100, "BRL", new DateOnly(2026, 11, 5), null, Guid.NewGuid()),
                    CancellationToken.None));
            Assert.Equal(FinancialErrorCodes.GoalProgressUnexplained, unexplained.Code);

            var key = Guid.NewGuid();
            var command = new AllocateGoalCommand(
                householdId, goalId, 4_000, "BRL", new DateOnly(2026, 11, 1), " reserva ", key);
            var first = await service.AllocateToGoalAsync(actorUserId, command, CancellationToken.None);
            Assert.Equal(4_000, first.AllocatedCents);
            Assert.Equal(GoalAllocationKind.Contribution, first.Kind);
            Assert.Equal("reserva", first.Note);
            Assert.False(first.Replayed);
            var replay = await service.AllocateToGoalAsync(
                actorUserId, command with { Currency = "brl", Note = "reserva" }, CancellationToken.None);
            Assert.True(replay.Replayed);
            Assert.Equal(first.Id, replay.Id);
            Assert.Equal(1L, await CountAsync("public.goal_allocations", "goal_id", goalId));
            var conflict = await Assert.ThrowsAsync<IdempotencyException>(() =>
                service.AllocateToGoalAsync(actorUserId, command with { AmountCents = 100 }, CancellationToken.None));
            Assert.Equal(IdempotencyErrorCodes.Conflict, conflict.Code);
            var mismatch = await Assert.ThrowsAsync<FinancialRuleException>(() =>
                service.AllocateToGoalAsync(actorUserId, command with
                {
                    AmountCents = 100,
                    Currency = "USD",
                    IdempotencyKey = Guid.NewGuid(),
                }, CancellationToken.None));
            Assert.Equal(FinancialErrorCodes.CurrencyMismatch, mismatch.Code);

            var second = await service.AllocateToGoalAsync(actorUserId, new AllocateGoalCommand(
                householdId, goalId, 6_000, "BRL", new DateOnly(2026, 11, 2), null, Guid.NewGuid()),
                CancellationToken.None);
            Assert.Equal(GoalStatus.Completed, second.GoalStatus);
            Assert.Equal(10_000, second.AllocatedCents);
            var blocked = await Assert.ThrowsAsync<FinancialRuleException>(() =>
                service.AllocateToGoalAsync(actorUserId, new AllocateGoalCommand(
                    householdId, goalId, 1, "BRL", new DateOnly(2026, 11, 2), null, Guid.NewGuid()),
                    CancellationToken.None));
            Assert.Equal(FinancialErrorCodes.InvalidGoalName, blocked.Code);

            var reversal = await service.ReverseGoalAllocationAsync(actorUserId, new ReverseGoalAllocationCommand(
                householdId, goalId, first.Id, new DateOnly(2026, 11, 3), "desfeito", Guid.NewGuid()),
                CancellationToken.None);
            Assert.Equal(first.Id, reversal.ReversalOf);
            Assert.Equal(6_000, reversal.AllocatedCents);
            Assert.Equal(GoalStatus.Active, reversal.GoalStatus);
            Assert.Equal(GoalAllocationKind.Reversal, reversal.Kind);
            var duplicate = await Assert.ThrowsAsync<FinancialRuleException>(() =>
                service.ReverseGoalAllocationAsync(actorUserId, new ReverseGoalAllocationCommand(
                    householdId, goalId, first.Id, new DateOnly(2026, 11, 4), null, Guid.NewGuid()),
                    CancellationToken.None));
            Assert.Equal(FinancialErrorCodes.GoalAllocationNotReversible, duplicate.Code);
            var reversalOfReversal = await Assert.ThrowsAsync<FinancialRuleException>(() =>
                service.ReverseGoalAllocationAsync(actorUserId, new ReverseGoalAllocationCommand(
                    householdId, goalId, reversal.Id, new DateOnly(2026, 11, 4), null, Guid.NewGuid()),
                    CancellationToken.None));
            Assert.Equal(FinancialErrorCodes.ReversalOfReversal, reversalOfReversal.Code);

            var history = await service.ListGoalAllocationsAsync(
                actorUserId, householdId, goalId, CancellationToken.None);
            Assert.Equal(3, history.Allocations.Count);
            Assert.True(history.ProgressIsExplained);
            Assert.Equal(6_000, history.AllocatedCents);
            Assert.Contains(history.Allocations, item => item.Id == first.Id && item.Kind == GoalAllocationKind.Contribution);
            Assert.Equal(6_000L, await ScalarAsync<long>(
                "select allocated_cents from public.goals where id = @goal_id", ("goal_id", goalId)));
            Assert.Equal(2L, await ScalarAsync<long>("""
                select count(*) from public.goal_allocations
                where goal_id = @goal_id and kind = 'contribution'
                """, ("goal_id", goalId)));
        }
        finally
        {
            await ExecuteAsync(
                "update public.goals set archived_at = now(), status_id = 12 where id = @goal_id",
                ("goal_id", goalId));
        }
    }

    [Fact]
    public async Task RealizingARecurringDatePostsOneTransactionAndRejectsASecond()
    {
        await using var context = CreateContext();
        var service = new RecurringPlanService(
            new EfRecurringPlanStore(context, new IdempotencyPolicy(), TimeProvider.System));
        var plan = await service.CreateAsync(actorUserId, new CreateRecurringPlanCommand(
            Guid.NewGuid(), householdId, "Rent", FinancialFlow.Expense, accountId, expenseCategoryId,
            null, 18_000, "BRL", 31, new DateOnly(2026, 1, 1), null, Guid.NewGuid()), CancellationToken.None);
        var scheduled = new DateOnly(2026, 2, 28);
        var command = new RealizeRecurringOccurrenceCommand(householdId, plan.Id, scheduled, Guid.NewGuid());

        var first = await service.RealizeAsync(actorUserId, command, CancellationToken.None);
        Assert.Equal(scheduled, first.ScheduledOn);
        Assert.Equal(18_000, first.AmountCents);
        Assert.Equal("BRL", first.Currency);
        Assert.Equal(FinancialFlow.Expense, first.Flow);
        Assert.Equal(plan.Id, first.PlanId);
        Assert.False(first.Replayed);

        var replay = await service.RealizeAsync(actorUserId, command, CancellationToken.None);
        Assert.True(replay.Replayed);
        Assert.Equal(first.Id, replay.Id);
        Assert.Equal(first.TransactionId, replay.TransactionId);
        Assert.Equal(1L, await CountAsync("public.recurring_occurrences", "plan_id", plan.Id));
        Assert.Equal(1L, await CountAsync("public.transactions", "id", first.TransactionId));
        Assert.Equal("Rent", await ScalarAsync<string>(
            "select description from public.transactions where id = @transaction_id",
            ("transaction_id", first.TransactionId)));

        var duplicate = await Assert.ThrowsAsync<FinancialRuleException>(() =>
            service.RealizeAsync(actorUserId, command with { IdempotencyKey = Guid.NewGuid() }, CancellationToken.None));
        Assert.Equal(FinancialErrorCodes.RecurringOccurrenceAlreadyRealized, duplicate.Code);
        var conflict = await Assert.ThrowsAsync<IdempotencyException>(() =>
            service.RealizeAsync(actorUserId, command with { ScheduledOn = new DateOnly(2026, 3, 31) }, CancellationToken.None));
        Assert.Equal(IdempotencyErrorCodes.Conflict, conflict.Code);
        var offSchedule = await Assert.ThrowsAsync<FinancialRuleException>(() =>
            service.RealizeAsync(actorUserId, new RealizeRecurringOccurrenceCommand(
                householdId, plan.Id, new DateOnly(2026, 2, 27), Guid.NewGuid()), CancellationToken.None));
        Assert.Equal(FinancialErrorCodes.InvalidRecurringPlan, offSchedule.Code);

        var march = await service.RealizeAsync(actorUserId, new RealizeRecurringOccurrenceCommand(
            householdId, plan.Id, new DateOnly(2026, 3, 31), Guid.NewGuid()), CancellationToken.None);
        Assert.NotEqual(first.TransactionId, march.TransactionId);

        await service.ChangeStatusAsync(
            householdId, plan.Id, RecurringPlanStatus.Paused, actorUserId, CancellationToken.None);
        var paused = await Assert.ThrowsAsync<FinancialRuleException>(() =>
            service.RealizeAsync(actorUserId, new RealizeRecurringOccurrenceCommand(
                householdId, plan.Id, new DateOnly(2026, 4, 30), Guid.NewGuid()), CancellationToken.None));
        Assert.Equal(FinancialErrorCodes.InvalidRecurringPlan, paused.Code);

        var listed = await service.ListOccurrencesAsync(householdId, plan.Id, actorUserId, CancellationToken.None);
        Assert.Equal(2, listed.Count);
        Assert.Contains(listed, item => item.Id == first.Id && item.TransactionId == first.TransactionId);
        Assert.Equal(2L, await CountAsync("public.transactions", "description", "Rent"));
    }

    [Fact]
    public async Task HistoricalForecastOpeningBalanceStopsAtAsOf()
    {
        await using var context = CreateContext();
        var ledger = new LedgerService(CreateStore(context));
        await ledger.PostIncomeAsync(actorUserId, new PostIncomeCommand(
            householdId, accountId, categoryId, 5_000, "BRL", new DateOnly(2026, 1, 10), Guid.NewGuid(), null),
            CancellationToken.None);
        var expense = await ledger.PostExpenseAsync(actorUserId, new PostExpenseCommand(
            householdId, accountId, expenseCategoryId, 1_000, "BRL", new DateOnly(2026, 1, 20), Guid.NewGuid(), null),
            CancellationToken.None);
        await ledger.PostIncomeAsync(actorUserId, new PostIncomeCommand(
            householdId, accountId, categoryId, 100, "BRL", new DateOnly(2026, 2, 15), Guid.NewGuid(), null),
            CancellationToken.None);
        await ledger.PostExpenseAsync(actorUserId, new PostExpenseCommand(
            householdId, accountId, expenseCategoryId, 500, "BRL", new DateOnly(2026, 3, 1), Guid.NewGuid(), null),
            CancellationToken.None);
        await ledger.ReverseAsync(actorUserId, new ReverseTransactionCommand(
            householdId, expense.TransactionId, new DateOnly(2026, 3, 2), Guid.NewGuid(), null),
            CancellationToken.None);

        var asOf = new DateOnly(2026, 2, 15);
        var forecast = await new ForecastService(new EfForecastStore(context, new IdempotencyPolicy(), TimeProvider.System))
            .CreateAsync(householdId, accountId, asOf, 1, actorUserId, Guid.NewGuid(), CancellationToken.None);

        Assert.Equal(asOf, forecast.AsOf);
        Assert.Equal(4_100, forecast.OpeningBalanceCents);
        Assert.Equal(4_100, forecast.Points.Single().ProjectedBalanceCents);
        Assert.Equal(4_100L, await ScalarAsync<long>(
            "select opening_balance_cents from public.forecasts where id = @forecast_id",
            ("forecast_id", forecast.Id)));
        Assert.Empty(forecast.Assumptions);
    }

    [Fact]
    public async Task SavedForecastKeepsPlanTermsAfterThePlanChanges()
    {
        await using var context = CreateContext();
        var plans = new RecurringPlanService(new EfRecurringPlanStore(context, new IdempotencyPolicy(), TimeProvider.System));
        var plan = await plans.CreateAsync(actorUserId, new CreateRecurringPlanCommand(
            Guid.NewGuid(), householdId, "Rent", FinancialFlow.Expense, accountId, expenseCategoryId,
            null, 18_000, "BRL", 5, new DateOnly(2026, 1, 1), null, Guid.NewGuid()), CancellationToken.None);
        var asOf = new DateOnly(2026, 11, 1);
        var created = await new ForecastService(new EfForecastStore(context, new IdempotencyPolicy(), TimeProvider.System))
            .CreateAsync(householdId, accountId, asOf, 1, actorUserId, Guid.NewGuid(), CancellationToken.None);

        await ExecuteAsync(
            "update public.recurring_plans set name = 'Changed', amount_cents = 1, day_of_month = 1, currency = 'USD' where id = @plan_id",
            ("plan_id", plan.Id));
        var forecast = await new ForecastService(new EfForecastStore(context, new IdempotencyPolicy(), TimeProvider.System))
            .GetAsync(householdId, created.Id, actorUserId, CancellationToken.None);

        var assumption = Assert.Single(forecast.Assumptions);
        var contribution = Assert.Single(forecast.Points.Single().Contributions);
        Assert.Equal(plan.Id, assumption.PlanId);
        Assert.Equal("Rent", assumption.Name);
        Assert.Equal(18_000, assumption.AmountCents);
        Assert.Equal("BRL", assumption.Currency);
        Assert.Equal(5, assumption.DayOfMonth);
        Assert.Equal(accountId, assumption.AccountId);
        Assert.Equal(expenseCategoryId, assumption.CategoryId);
        Assert.Equal(RecurringPlanStatus.Active, assumption.Status);
        Assert.Equal(new DateOnly(2026, 11, 5), contribution.ScheduledOn);
        Assert.Equal(18_000, contribution.AmountCents);
        Assert.Equal(18_000, forecast.Points.Single().ExpectedExpenseCents);
        Assert.Equal("Changed", await ScalarAsync<string>(
            "select name from public.recurring_plans where id = @plan_id", ("plan_id", plan.Id)));
    }

    [Fact]
    public async Task DashboardRejectsAnActorOutsideTheHousehold()
    {
        await using var context = CreateContext();

        var exception = await Assert.ThrowsAsync<HouseholdRuleException>(() =>
            CreateDashboardUseCase(context).ExecuteAsync(
                new GetFinancialDashboardQuery(Guid.NewGuid(), householdId, 2026, 9),
                CancellationToken.None));

        Assert.Equal(HouseholdErrorCodes.MembershipRequired, exception.Code);
    }

    [Fact]
    public async Task CreateIncomeSourceSucceedsAndAudits()
    {
        await using var context = CreateContext();
        var store = CreateStore(context);
        var sourceId = Guid.NewGuid();

        var created = await store.CreateIncomeSourceAsync(
            IncomeSource.Create(sourceId, householdId, "  Company Acme  "),
            actorUserId,
            CancellationToken.None);

        Assert.Equal(sourceId, created.Id);
        Assert.Equal("Company Acme", created.Name);

        var list = await store.GetIncomeSourcesAsync(actorUserId, householdId, false, CancellationToken.None);
        Assert.Contains(list, item => item.Id == sourceId && item.Name == "Company Acme");

        Assert.Equal(1, await CountAsync("public.audit_events", "action", "financial.income_source.created"));
    }

    [Fact]
    public async Task CreateDuplicateIncomeSourceFailsCaseInsensitively()
    {
        await using var context = CreateContext();
        var store = CreateStore(context);
        await store.CreateIncomeSourceAsync(
            IncomeSource.Create(Guid.NewGuid(), householdId, "Freelance Work"),
            actorUserId,
            CancellationToken.None);

        var exception = await Assert.ThrowsAsync<FinancialRuleException>(() =>
            store.CreateIncomeSourceAsync(
                IncomeSource.Create(Guid.NewGuid(), householdId, "freelance work"),
                actorUserId,
                CancellationToken.None));

        Assert.Equal(FinancialErrorCodes.IncomeSourceConflict, exception.Code);
    }

    [Fact]
    public async Task ArchiveIncomeSourceHidesFromFutureEntryAndAudits()
    {
        await using var context = CreateContext();
        var store = CreateStore(context);
        var sourceId = Guid.NewGuid();
        await store.CreateIncomeSourceAsync(
            IncomeSource.Create(sourceId, householdId, "Consulting"),
            actorUserId,
            CancellationToken.None);

        await store.ArchiveIncomeSourceAsync(householdId, sourceId, actorUserId, CancellationToken.None);

        var activeSources = await store.GetIncomeSourcesAsync(actorUserId, householdId, false, CancellationToken.None);
        Assert.DoesNotContain(activeSources, item => item.Id == sourceId);

        var allSources = await store.GetIncomeSourcesAsync(actorUserId, householdId, true, CancellationToken.None);
        var archived = Assert.Single(allSources, item => item.Id == sourceId);
        Assert.NotNull(archived.ArchivedAt);

        Assert.Equal(1, await CountAsync("public.audit_events", "action", "financial.income_source.archived"));

        var service = new LedgerService(store);
        var exception = await Assert.ThrowsAsync<FinancialRuleException>(() =>
            service.PostIncomeAsync(
                actorUserId,
                new PostIncomeCommand(
                    householdId, accountId, categoryId, 5_000, "BRL",
                    new DateOnly(2026, 9, 15), Guid.NewGuid(), "Archived Source Income", sourceId),
                CancellationToken.None));
        Assert.Equal(FinancialErrorCodes.InvalidIncomeSource, exception.Code);
    }

    [Fact]
    public async Task ArchiveAlreadyArchivedIncomeSourceIsNoOp()
    {
        await using var context = CreateContext();
        var store = CreateStore(context);
        var sourceId = Guid.NewGuid();
        await store.CreateIncomeSourceAsync(
            IncomeSource.Create(sourceId, householdId, "Side Gig"),
            actorUserId,
            CancellationToken.None);

        await store.ArchiveIncomeSourceAsync(householdId, sourceId, actorUserId, CancellationToken.None);
        await store.ArchiveIncomeSourceAsync(householdId, sourceId, actorUserId, CancellationToken.None);

        Assert.Equal(1, await CountAsync("public.audit_events", "action", "financial.income_source.archived"));
    }

    [Fact]
    public async Task ArchiveNonExistentIncomeSourceThrowsNotFound()
    {
        await using var context = CreateContext();
        var store = CreateStore(context);

        var exception = await Assert.ThrowsAsync<FinancialRuleException>(() =>
            store.ArchiveIncomeSourceAsync(householdId, Guid.NewGuid(), actorUserId, CancellationToken.None));

        Assert.Equal(FinancialErrorCodes.IncomeSourceNotFound, exception.Code);
    }

    [Fact]
    public async Task GetHistoryWithSearchAndIncomeSourceFilter()
    {
        await using var context = CreateContext();
        var store = CreateStore(context);
        var sourceId = Guid.NewGuid();
        await store.CreateIncomeSourceAsync(
            IncomeSource.Create(sourceId, householdId, "Client Alpha"),
            actorUserId,
            CancellationToken.None);

        var service = new LedgerService(store);
        await service.PostIncomeAsync(
            actorUserId,
            new PostIncomeCommand(
                householdId, accountId, categoryId, 12_000, "BRL",
                new DateOnly(2026, 9, 18), Guid.NewGuid(), "Monthly Consulting Payment", sourceId),
            CancellationToken.None);
        await service.PostIncomeAsync(
            actorUserId,
            new PostIncomeCommand(
                householdId, accountId, categoryId, 3_000, "BRL",
                new DateOnly(2026, 9, 19), Guid.NewGuid(), "Dividend payout", null),
            CancellationToken.None);

        var searchResults = await store.GetHistoryAsync(
            actorUserId, householdId, 100,
            new LedgerHistoryFilter(Search: "consulting"),
            CancellationToken.None);

        var matched = Assert.Single(searchResults);
        Assert.Equal("Monthly Consulting Payment", matched.Description);

        var sourceResults = await store.GetHistoryAsync(
            actorUserId, householdId, 100,
            new LedgerHistoryFilter(IncomeSourceId: sourceId),
            CancellationToken.None);

        var sourceMatched = Assert.Single(sourceResults);
        Assert.Equal(sourceId, sourceMatched.IncomeSourceId);
    }

    [Fact]
    public async Task CorrectTransactionClassificationUpdatesCategoryAndDescriptionWithoutAlteringBalances()
    {
        await using var context = CreateContext();
        var store = CreateStore(context);
        var service = new LedgerService(store);

        var result = await service.PostExpenseAsync(
            actorUserId,
            new PostExpenseCommand(
                householdId,
                accountId,
                expenseCategoryId,
                5_000,
                "BRL",
                new DateOnly(2026, 9, 20),
                Guid.NewGuid(),
                "Original Expense Description"),
            CancellationToken.None);

        var initialBalances = await store.GetBalancesAsync(actorUserId, householdId, CancellationToken.None);

        var newCategory = await store.CreateCategoryAsync(
            householdId, actorUserId, Guid.NewGuid(), "Transport",
            FinancialFlow.Expense, null,
            IdempotencyRequest.Create(householdId, actorUserId, IdempotencyOperation.CreateCategory, Guid.NewGuid()),
            CancellationToken.None);

        var correctedItem = await service.CorrectClassificationAsync(
            householdId,
            result.TransactionId,
            actorUserId,
            newCategory.Id,
            null,
            "Updated Expense Description",
            CancellationToken.None);

        Assert.Equal(newCategory.Id, correctedItem.CategoryId);
        Assert.Equal("Updated Expense Description", correctedItem.Description);

        var postCorrectionBalances = await store.GetBalancesAsync(actorUserId, householdId, CancellationToken.None);
        Assert.Equal(initialBalances.Single(b => b.AccountId == accountId).BalanceCents,
                     postCorrectionBalances.Single(b => b.AccountId == accountId).BalanceCents);
    }

    [Fact]
    public async Task StaleCorrectionRollsBackWhileIdempotentReplayDoesNotOverwriteTheCurrentRecord()
    {
        Guid transactionId;
        await using (var setup = CreateContext())
        {
            var result = await new LedgerService(CreateStore(setup)).PostExpenseAsync(actorUserId,
                new PostExpenseCommand(householdId, accountId, expenseCategoryId, 32_000, "BRL",
                    new DateOnly(2026, 11, 2), Guid.NewGuid(), "Original"), CancellationToken.None);
            transactionId = result.TransactionId;
        }
        var original = new TransactionClassificationSnapshot(FinancialTransactionStatus.Posted, expenseCategoryId, null, "Original");
        var winnerKey = Guid.NewGuid();
        async Task<LedgerHistoryItem> CorrectAsync(string description, Guid key, TransactionClassificationSnapshot expected)
        {
            await using var context = CreateContext();
            return await new LedgerService(CreateStore(context)).CorrectClassificationAsync(householdId,
                transactionId, actorUserId, expenseCategoryId, null, description,
                CancellationToken.None, key, expected);
        }

        var winner = await CorrectAsync("Winner", winnerKey, original);
        var failure = await Assert.ThrowsAsync<FinancialRuleException>(() => CorrectAsync("Stale update", Guid.NewGuid(), original));
        Assert.Equal(FinancialErrorCodes.TransactionChanged, failure.Code);
        var refreshed = original with { Description = "Winner" };
        await CorrectAsync("Latest", Guid.NewGuid(), refreshed);
        var replay = await CorrectAsync("Winner", winnerKey, original);
        Assert.Equal(winner.Description, replay.Description);

        await using var verification = CreateContext();
        var store = CreateStore(verification);
        var rows = await store.GetHistoryAsync(actorUserId, householdId, 2,
            new LedgerHistoryFilter(TransactionId: transactionId), CancellationToken.None);
        Assert.Equal("Latest", Assert.Single(rows).Description);
        var balances = await store.GetBalancesAsync(actorUserId, householdId, CancellationToken.None);
        Assert.Equal(-32_000, balances.Single(balance => balance.AccountId == accountId).BalanceCents);
    }

    [Fact]
    public async Task CorrectionAfterReversalIsRejectedAndTheCompensationCanBeReadByOriginalId()
    {
        Guid transactionId;
        await using (var setup = CreateContext())
        {
            var result = await new LedgerService(CreateStore(setup)).PostExpenseAsync(actorUserId,
                new PostExpenseCommand(householdId, accountId, expenseCategoryId, 32_000, "BRL",
                    new DateOnly(2026, 11, 2), Guid.NewGuid(), "Original"), CancellationToken.None);
            transactionId = result.TransactionId;
        }
        var reversal = await ReverseAsync(transactionId, Guid.NewGuid());
        await using var context = CreateContext();
        var store = CreateStore(context);
        var failure = await Assert.ThrowsAsync<FinancialRuleException>(() =>
            new LedgerService(store).CorrectClassificationAsync(householdId, transactionId, actorUserId,
                expenseCategoryId, null, "Stale", CancellationToken.None, Guid.NewGuid(),
                new TransactionClassificationSnapshot(FinancialTransactionStatus.Posted, expenseCategoryId, null, "Original")));
        Assert.Equal(FinancialErrorCodes.TransactionChanged, failure.Code);
        var rows = await store.GetHistoryAsync(actorUserId, householdId, 2,
            new LedgerHistoryFilter(ReversalOf: transactionId), CancellationToken.None);
        Assert.Equal(reversal.TransactionId, Assert.Single(rows).TransactionId);
        var balances = await store.GetBalancesAsync(actorUserId, householdId, CancellationToken.None);
        Assert.Equal(0, balances.Single(balance => balance.AccountId == accountId).BalanceCents);
    }

    [Fact]
    public async Task ArchivedAccountAndSourceRemainInHistoricalIncomeAndFilteredHistory()
    {
        await using var context = CreateContext();
        var store = CreateStore(context);
        var sourceId = Guid.NewGuid();
        await store.CreateIncomeSourceAsync(IncomeSource.Create(sourceId, householdId, "Historical salary"), actorUserId, CancellationToken.None);
        var service = new LedgerService(store);
        var created = await service.PostIncomeAsync(actorUserId,
            new PostIncomeCommand(householdId, accountId, categoryId, 12345, "BRL", new DateOnly(2026, 9, 15), Guid.NewGuid(), "Salary", sourceId), CancellationToken.None);
        await service.ArchiveAccountAsync(householdId, accountId, actorUserId, CancellationToken.None);
        await store.ArchiveIncomeSourceAsync(householdId, sourceId, actorUserId, CancellationToken.None);

        var reader = new EfDashboardReader(context);
        var active = await reader.ReadAsync(actorUserId, householdId, FinancialPeriod.Monthly(2026, 9), CancellationToken.None);
        Assert.DoesNotContain(active.Accounts, item => item.Id == accountId);
        var breakdown = await new GetIncomeBreakdown(new EfHouseholdMembershipReader(context), reader).ExecuteAsync(
            new GetIncomeBreakdownQuery(actorUserId, householdId, "BRL", 2026, 9, IncludeArchivedAccounts: true), CancellationToken.None);
        var source = Assert.Single(breakdown.Sources, item => item.IncomeSourceId == sourceId);
        Assert.Equal(12345L, source.AmountCents);
        Assert.Equal("Historical salary", source.IncomeSourceName);
        var history = await store.GetHistoryAsync(actorUserId, householdId, 50,
            new LedgerHistoryFilter(IncomeSourceId: sourceId), CancellationToken.None);
        Assert.Contains(history, item => item.TransactionId == created.TransactionId);
    }

    private async Task<LedgerWriteResult> PostIncomeAsync(
        Guid idempotencyKey,
        long amountCents = 1_000,
        string description = "Salary",
        Guid? actorId = null)
    {
        await using var context = CreateContext();
        var service = new LedgerService(CreateStore(context));
        return await service.PostIncomeAsync(
            actorId ?? actorUserId,
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
        var service = new LedgerService(CreateStore(context));
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

    private static EfLedgerStore CreateStore(InOutDbContext context) =>
        new(context, new IdempotencyPolicy(), TimeProvider.System);

    private static GetFinancialDashboard CreateDashboardUseCase(InOutDbContext context) =>
        new(new EfHouseholdMembershipReader(context), new EfDashboardReader(context));

    private async Task ExecuteAsync(string sql, params (string Name, object Value)[] parameters)
    {
        await using var connection = new NpgsqlConnection(postgres.GetConnectionString());
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        Bind(command, parameters);
        await command.ExecuteNonQueryAsync();
    }

    private async Task<T> ScalarAsync<T>(string sql, params (string Name, object Value)[] parameters)
    {
        await using var connection = new NpgsqlConnection(postgres.GetConnectionString());
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        Bind(command, parameters);
        return (T)(await command.ExecuteScalarAsync())!;
    }

    private void Bind(NpgsqlCommand command, params (string Name, object Value)[] parameters)
    {
        command.Parameters.AddWithValue("household_id", householdId);
        command.Parameters.AddWithValue("actor_user_id", actorUserId);
        foreach (var (name, value) in parameters)
        {
            command.Parameters.AddWithValue(name, value);
        }
    }

    private async Task<long> CountAsync(string qualifiedTable)
    {
        await using var connection = new NpgsqlConnection(postgres.GetConnectionString());
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = $"select count(*) from {qualifiedTable}";
        return (long)(await command.ExecuteScalarAsync())!;
    }

    private async Task<long> CountAsync(string qualifiedTable, string column, object value)
    {
        await using var connection = new NpgsqlConnection(postgres.GetConnectionString());
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = $"select count(*) from {qualifiedTable} where {column} = @value";
        command.Parameters.AddWithValue("value", value);
        return (long)(await command.ExecuteScalarAsync())!;
    }

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
        create table public.status_types (
          code text primary key,
          name text not null,
          description text,
          created_at timestamptz not null default now()
        );
        create table public.status_values (
          id int primary key,
          type_code text not null references public.status_types(code) on delete cascade,
          code text not null,
          name text not null,
          description text,
          created_at timestamptz not null default now(),
          unique (type_code, code)
        );
        insert into public.status_types (code, name) values
          ('account_status', 'Account Status'),
          ('category_status', 'Category Status'),
          ('income_source_status', 'Income Source Status'),
          ('goal_status', 'Goal Status'),
          ('recurring_plan_status', 'Recurring Plan Status');
        insert into public.status_values (id, type_code, code, name) values
          (1, 'account_status', 'active', 'Active'),
          (2, 'account_status', 'frozen', 'Frozen'),
          (3, 'account_status', 'archived', 'Archived'),
          (4, 'category_status', 'active', 'Active'),
          (5, 'category_status', 'deprecated', 'Deprecated'),
          (6, 'category_status', 'archived', 'Archived'),
          (7, 'income_source_status', 'active', 'Active'),
          (8, 'income_source_status', 'archived', 'Archived'),
          (9, 'goal_status', 'active', 'Active'),
          (10, 'goal_status', 'paused', 'Paused'),
          (11, 'goal_status', 'completed', 'Completed'),
          (12, 'goal_status', 'archived', 'Archived'),
          (13, 'recurring_plan_status', 'active', 'Active'),
          (14, 'recurring_plan_status', 'paused', 'Paused'),
          (15, 'recurring_plan_status', 'archived', 'Archived');
        create table public.accounts (
          id uuid primary key,
          household_id uuid not null references public.households(id),
          name text not null,
          kind text not null,
          currency text not null,
          status_id int not null default 1 references public.status_values(id),
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
          status_id int not null default 4 references public.status_values(id),
          created_by uuid not null,
          created_at timestamptz not null default now(),
          archived_at timestamptz,
          unique (household_id, id)
        );
        create table public.income_sources (
          id uuid primary key,
          household_id uuid not null references public.households(id),
          name text not null,
          status_id int not null default 7 references public.status_values(id),
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
          reversal_of uuid,
          opening_account_id uuid,
          income_source_id uuid,
          created_by uuid not null,
          created_at timestamptz not null default now(),
          posted_at timestamptz,
          unique (household_id, id),
          foreign key (household_id, reversal_of) references public.transactions(household_id, id)
        );
        create unique index transactions_one_opening_balance_per_account_uidx
          on public.transactions (household_id, opening_account_id)
          where kind = 'opening_balance';
        create unique index transactions_one_reversal_per_original_uidx
          on public.transactions (household_id, reversal_of)
          where kind = 'reversal';
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
        create table public.budgets (
          id uuid primary key,
          household_id uuid not null references public.households(id),
          category_id uuid not null,
          period_start date not null,
          period_end date not null,
          limit_cents bigint not null,
          created_by uuid
        );
        create table public.goals (
          id uuid primary key,
          household_id uuid not null references public.households(id),
          name text not null,
          target_cents bigint not null,
          allocated_cents bigint not null,
          target_date date,
          status_id int not null default 9 references public.status_values(id),
          created_by uuid not null,
          created_at timestamptz not null default now(),
          archived_at timestamptz
        );
        create table public.goal_allocations (
          id uuid primary key,
          household_id uuid not null references public.households(id),
          goal_id uuid not null references public.goals(id),
          amount_cents bigint not null,
          currency text not null,
          kind text not null,
          origin text not null,
          reversal_of uuid,
          occurred_on date not null,
          note text,
          created_by uuid not null,
          created_at timestamptz not null default now()
        );
        create unique index goal_allocations_one_reversal_per_original_uidx
          on public.goal_allocations (household_id, reversal_of)
          where kind = 'reversal';
        create table public.recurring_plans (
          id uuid primary key,
          household_id uuid not null references public.households(id),
          name text not null,
          flow text not null,
          account_id uuid not null,
          category_id uuid not null,
          income_source_id uuid,
          amount_cents bigint not null,
          currency text not null,
          day_of_month int not null,
          starts_on date not null,
          ends_on date,
          status_id int not null default 13 references public.status_values(id),
          created_by uuid not null,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (household_id, id)
        );
        create table public.recurring_occurrences (
          id uuid primary key,
          household_id uuid not null references public.households(id),
          plan_id uuid not null,
          scheduled_on date not null,
          transaction_id uuid not null,
          flow text not null,
          amount_cents bigint not null,
          currency text not null,
          created_by uuid not null,
          created_at timestamptz not null default now(),
          constraint recurring_occurrences_plan_date_uidx unique (household_id, plan_id, scheduled_on),
          constraint recurring_occurrences_transaction_uidx unique (transaction_id),
          foreign key (household_id, plan_id) references public.recurring_plans (household_id, id),
          foreign key (household_id, transaction_id) references public.transactions (household_id, id)
        );
        create table public.forecasts (
          id uuid primary key,
          household_id uuid not null references public.households(id),
          account_id uuid not null,
          currency text not null,
          as_of date not null,
          months int not null,
          opening_balance_cents bigint not null,
          points jsonb not null,
          assumptions jsonb not null default '[]'::jsonb,
          calculated_at timestamptz not null,
          created_by uuid not null
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
        create table private.idempotency_requests (
          tenant_id uuid not null,
          operation text not null,
          idempotency_key uuid not null,
          actor_user_id uuid not null,
          request_fingerprint text not null,
          status text not null,
          response_code integer,
          response_body jsonb,
          resource_type text,
          resource_id uuid,
          attempt_count integer not null,
          locked_until timestamptz not null,
          created_at timestamptz not null,
          updated_at timestamptz not null,
          completed_at timestamptz,
          expires_at timestamptz not null,
          last_error_code text,
          primary key (tenant_id, operation, idempotency_key)
        );
        create table private.outbox_messages (
          id uuid primary key,
          tenant_id uuid not null,
          aggregate_type text not null,
          aggregate_id uuid not null,
          aggregate_version bigint not null,
          event_type text not null,
          payload jsonb not null,
          occurred_at timestamptz not null,
          published_at timestamptz,
          attempt_count integer not null default 0,
          last_error text,
          unique (aggregate_type, aggregate_id, aggregate_version)
        );
        create table private.inbox_messages (
          consumer text not null,
          message_id uuid not null,
          tenant_id uuid not null,
          message_fingerprint text not null,
          status text not null,
          received_at timestamptz not null,
          processed_at timestamptz,
          primary key (consumer, message_id)
        );
        create table private.household_invitations (
          id uuid primary key,
          household_id uuid not null references public.households(id),
          token_hash bytea not null,
          created_by uuid not null,
          created_at timestamptz not null default now(),
          expires_at timestamptz not null,
          accepted_by uuid,
          accepted_at timestamptz,
          revoked_at timestamptz
        );
        """;
}
