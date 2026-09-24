using System.Security.Claims;
using InOut.Api.Security;
using InOut.Application.Financial;
using InOut.Application.Financial.Dashboard;
using InOut.Application.Financial.Export;
using InOut.Domain.Financial;
using Microsoft.AspNetCore.Mvc;

namespace InOut.Api.Financial;

public static class LedgerEndpoints
{
    public static IEndpointRouteBuilder MapLedgerEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var ledger = endpoints.MapGroup(ApiContract.Routes.Ledger)
            .RequireAuthorization(HouseholdMemberRequirement.PolicyName)
            .WithTags(ApiContract.Tags.Ledger);

        ledger.MapPost(ApiContract.Routes.Accounts, async (
            Guid householdId,
            CreateAccountRequest request,
            [FromHeader(Name = ApiContract.Headers.IdempotencyKey)] Guid idempotencyKey,
            ClaimsPrincipal principal,
            LedgerService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.CreateAccountAsync(
                UserId(principal),
                new CreateAccountCommand(
                    request.Id,
                    householdId,
                    request.Name,
                    request.Kind,
                    request.Currency,
                    request.InitialBalanceCents,
                    request.OpeningDate,
                    idempotencyKey),
                cancellationToken);
            return result.Replayed
                ? Results.Ok(result)
                : Results.Created(
                    ApiContract.Routes.AccountResource(householdId, result.Account.Id),
                    result);
        }).WithName(ApiContract.EndpointNames.CreateAccount);

        ledger.MapGet(ApiContract.Routes.Accounts, async (
            Guid householdId,
            bool includeArchived,
            LedgerService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetAccountsAsync(householdId, includeArchived, cancellationToken)))
            .WithName(ApiContract.EndpointNames.GetAccounts);

        ledger.MapDelete(ApiContract.Routes.AccountById, async (
            Guid householdId,
            Guid accountId,
            ClaimsPrincipal principal,
            LedgerService service,
            CancellationToken cancellationToken) =>
        {
            await service.ArchiveAccountAsync(householdId, accountId, UserId(principal), cancellationToken);
            return Results.NoContent();
        }).WithName(ApiContract.EndpointNames.ArchiveAccount);

        ledger.MapGet(ApiContract.Routes.Categories, async (
            Guid householdId,
            FinancialFlow? flow,
            bool includeArchived,
            LedgerService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetCategoriesAsync(householdId, flow, includeArchived, cancellationToken)))
            .WithName(ApiContract.EndpointNames.GetCategories);

        ledger.MapPost(ApiContract.Routes.Categories, async (
            Guid householdId,
            CreateCategoryRequest request,
            [FromHeader(Name = ApiContract.Headers.IdempotencyKey)] Guid idempotencyKey,
            ClaimsPrincipal principal,
            LedgerService service,
            CancellationToken cancellationToken) =>
        {
            var category = await service.CreateCategoryAsync(
                householdId, UserId(principal), request.Id, request.Name, request.Flow,
                request.ParentId, idempotencyKey, cancellationToken);
            return Results.Created(ApiContract.Routes.CategoryResource(householdId, category.Id), category);
        }).WithName(ApiContract.EndpointNames.CreateCategory);

        ledger.MapDelete(ApiContract.Routes.CategoryById, async (
            Guid householdId,
            Guid categoryId,
            ClaimsPrincipal principal,
            LedgerService service,
            CancellationToken cancellationToken) =>
        {
            await service.ArchiveCategoryAsync(householdId, categoryId, UserId(principal), cancellationToken);
            return Results.NoContent();
        }).WithName(ApiContract.EndpointNames.ArchiveCategory);

        ledger.MapGet(ApiContract.Routes.History, async (
            Guid householdId,
            int? limit,
            DateOnly? from,
            DateOnly? to,
            Guid? accountId,
            Guid? categoryId,
            FinancialTransactionKind? kind,
            LedgerService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetHistoryAsync(householdId, limit ?? 100,
                new LedgerHistoryFilter(from, to, accountId, categoryId, kind), cancellationToken)))
            .WithName(ApiContract.EndpointNames.GetLedgerHistory);

        ledger.MapPost(ApiContract.Routes.Income, async (
            Guid householdId,
            PostIncomeRequest request,
            [FromHeader(Name = ApiContract.Headers.IdempotencyKey)] Guid idempotencyKey,
            ClaimsPrincipal principal,
            LedgerService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.PostIncomeAsync(
                UserId(principal),
                new PostIncomeCommand(
                    householdId,
                    request.AccountId,
                    request.CategoryId,
                    request.AmountCents,
                    request.Currency,
                    request.OccurredOn,
                    idempotencyKey,
                    request.Description),
                cancellationToken);
            return WriteResult(householdId, result);
        }).WithName(ApiContract.EndpointNames.PostIncome);

        ledger.MapPost(ApiContract.Routes.Expenses, async (
            Guid householdId,
            PostExpenseRequest request,
            [FromHeader(Name = ApiContract.Headers.IdempotencyKey)] Guid idempotencyKey,
            ClaimsPrincipal principal,
            LedgerService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.PostExpenseAsync(
                UserId(principal),
                new PostExpenseCommand(
                    householdId,
                    request.AccountId,
                    request.CategoryId,
                    request.AmountCents,
                    request.Currency,
                    request.OccurredOn,
                    idempotencyKey,
                    request.Description),
                cancellationToken);
            return WriteResult(householdId, result);
        }).WithName(ApiContract.EndpointNames.PostExpense);

        ledger.MapPost(ApiContract.Routes.Transfers, async (
            Guid householdId,
            PostTransferRequest request,
            [FromHeader(Name = ApiContract.Headers.IdempotencyKey)] Guid idempotencyKey,
            ClaimsPrincipal principal,
            LedgerService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.PostTransferAsync(
                UserId(principal),
                new PostTransferCommand(
                    householdId,
                    request.SourceAccountId,
                    request.DestinationAccountId,
                    request.AmountCents,
                    request.Currency,
                    request.OccurredOn,
                    idempotencyKey,
                    request.Description),
                cancellationToken);
            return WriteResult(householdId, result);
        }).WithName(ApiContract.EndpointNames.PostTransfer);

        ledger.MapPost(ApiContract.Routes.Reversals, async (
            Guid householdId,
            Guid transactionId,
            ReverseTransactionRequest request,
            [FromHeader(Name = ApiContract.Headers.IdempotencyKey)] Guid idempotencyKey,
            ClaimsPrincipal principal,
            LedgerService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.ReverseAsync(
                UserId(principal),
                new ReverseTransactionCommand(
                    householdId,
                    transactionId,
                    request.OccurredOn,
                    idempotencyKey,
                    request.Description),
                cancellationToken);
            return WriteResult(householdId, result);
        }).WithName(ApiContract.EndpointNames.ReverseTransaction);

        ledger.MapGet(ApiContract.Routes.Balances, async (
            Guid householdId,
            LedgerService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetBalancesAsync(householdId, cancellationToken)))
            .WithName(ApiContract.EndpointNames.GetAccountBalances);

        ledger.MapGet(ApiContract.Routes.Reconciliation, async (
            Guid householdId,
            LedgerService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.ReconcileAsync(householdId, cancellationToken)))
            .WithName(ApiContract.EndpointNames.ReconcileLedger);

        ledger.MapGet(ApiContract.Routes.Dashboard, async (
            Guid householdId,
            int year,
            int month,
            ClaimsPrincipal principal,
            GetFinancialDashboard useCase,
            CancellationToken cancellationToken) =>
            Results.Ok(await useCase.ExecuteAsync(
                new GetFinancialDashboardQuery(UserId(principal), householdId, year, month),
                cancellationToken)))
            .WithName(ApiContract.EndpointNames.GetFinancialDashboard);

        ledger.MapGet(ApiContract.Routes.ExportCsv, async (
            Guid householdId,
            ClaimsPrincipal principal,
            ExportFinancialData export,
            CancellationToken cancellationToken) =>
        {
            var rows = await export.ExecuteAsync(
                UserId(principal), householdId, cancellationToken);
            return Results.File(
                FinancialCsvWriter.Write(rows),
                "text/csv; charset=utf-8",
                $"inout-ledger-{householdId}.csv");
        }).WithName(ApiContract.EndpointNames.ExportFinancialCsv);

        return endpoints;
    }

    private static IResult WriteResult(Guid householdId, LedgerWriteResult result) =>
        result.Replayed
            ? Results.Ok(result)
            : Results.Created(
                ApiContract.Routes.TransactionResource(householdId, result.TransactionId),
                result);

    private static Guid UserId(ClaimsPrincipal principal) =>
        Guid.Parse(principal.FindFirstValue(ApiContract.Claims.Subject)!);

}
