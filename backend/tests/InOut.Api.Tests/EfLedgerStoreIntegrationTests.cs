using InOut.Application.Financial;
using InOut.Application.Financial.Dashboard;
using InOut.Application.Idempotency;
using InOut.Domain.Financial;
using InOut.Domain.Households;
using InOut.Infrastructure.Financial;
using InOut.Infrastructure.Idempotency;
using InOut.Infrastructure.Persistence;
using InOut.Infrastructure.Security;
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
              id, household_id, category_id, period_start, period_end, limit_cents)
            values (
              gen_random_uuid(), @household_id, @expense_category_id,
              '2026-09-01', '2026-09-30', 500);
            insert into public.goals (
              id, household_id, name, target_cents, allocated_cents, target_date)
            values (
              gen_random_uuid(), @household_id, 'Emergency fund', 10000, 2500, '2026-12-31');
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
        var store = CreateStore(context);
        var balances = await store.GetBalancesAsync(householdId, CancellationToken.None);
        var reconciliation = await store.ReconcileAsync(householdId, CancellationToken.None);
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
        var balances = await store.GetBalancesAsync(householdId, CancellationToken.None);
        var history = await store.GetHistoryAsync(householdId, 100, CancellationToken.None);
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
                .GetBalancesAsync(householdId, CancellationToken.None);
            var reconciliation = await CreateStore(context)
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
        var balances = await CreateStore(context)
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
        var store = CreateStore(context);
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
        var balances = await store.GetBalancesAsync(householdId, CancellationToken.None);
        var reconciliation = await store.ReconcileAsync(householdId, CancellationToken.None);
        var history = await store.GetHistoryAsync(householdId, 100, CancellationToken.None);

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

            Assert.DoesNotContain(await service.GetCategoriesAsync(householdId, FinancialFlow.Expense,
                false, CancellationToken.None), item => item.Id == childId);
            var archived = await service.GetCategoriesAsync(householdId, FinancialFlow.Expense,
                true, CancellationToken.None);
            Assert.Equal(rootId, Assert.Single(archived, item => item.Id == childId).ParentId);
            var history = await service.GetHistoryAsync(householdId, 100,
                new LedgerHistoryFilter(CategoryId: childId, Kind: FinancialTransactionKind.Expense),
                CancellationToken.None);
            Assert.Equal("Cinema", Assert.Single(history).CategoryName);
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
            var filtered = await service.GetHistoryAsync(householdId, 1,
                new LedgerHistoryFilter(From: new DateOnly(2026, 9, 14),
                    To: new DateOnly(2026, 9, 14), CategoryId: categoryId), CancellationToken.None);
            Assert.Equal(FinancialTransactionKind.Income, Assert.Single(filtered).Kind);
            var transfer = await service.GetHistoryAsync(householdId, 10,
                new LedgerHistoryFilter(Kind: FinancialTransactionKind.Transfer), CancellationToken.None);
            Assert.Equal(2, transfer.Count);
            Assert.All(transfer, item => Assert.Null(item.CategoryId));
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
    public async Task DashboardRejectsAnActorOutsideTheHousehold()
    {
        await using var context = CreateContext();

        var exception = await Assert.ThrowsAsync<HouseholdRuleException>(() =>
            CreateDashboardUseCase(context).ExecuteAsync(
                new GetFinancialDashboardQuery(Guid.NewGuid(), householdId, 2026, 9),
                CancellationToken.None));

        Assert.Equal(HouseholdErrorCodes.MembershipRequired, exception.Code);
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

    private async Task<long> CountAsync(string qualifiedTable)
    {
        await using var connection = new NpgsqlConnection(postgres.GetConnectionString());
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = $"select count(*) from {qualifiedTable}";
        return (long)(await command.ExecuteScalarAsync())!;
    }

    private async Task<long> CountAsync(string qualifiedTable, string column, Guid value)
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
          reversal_of uuid,
          opening_account_id uuid,
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
          limit_cents bigint not null
        );
        create table public.goals (
          id uuid primary key,
          household_id uuid not null references public.households(id),
          name text not null,
          target_cents bigint not null,
          allocated_cents bigint not null,
          target_date date,
          archived_at timestamptz
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
          accepted_at timestamptz
        );
        """;
}
