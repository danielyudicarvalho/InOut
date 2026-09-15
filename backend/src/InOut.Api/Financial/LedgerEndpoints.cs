using System.Security.Claims;
using InOut.Api.Security;
using InOut.Application.Financial;
using InOut.Domain.Financial;

namespace InOut.Api.Financial;

public static class LedgerEndpoints
{
    public static IEndpointRouteBuilder MapLedgerEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var ledger = endpoints.MapGroup("/api/v1/households/{householdId:guid}/ledger")
            .RequireAuthorization(HouseholdMemberRequirement.PolicyName)
            .WithTags("Ledger");

        ledger.MapPost("/accounts", async (
            Guid householdId,
            CreateAccountRequest request,
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
                    request.IdempotencyKey),
                cancellationToken);
            return result.Replayed
                ? Results.Ok(result)
                : Results.Created(
                    $"/api/v1/households/{householdId}/ledger/accounts/{result.Account.Id}",
                    result);
        }).WithName("CreateAccount");

        ledger.MapGet("/accounts", async (
            Guid householdId,
            bool includeArchived,
            LedgerService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetAccountsAsync(householdId, includeArchived, cancellationToken)))
            .WithName("GetAccounts");

        ledger.MapDelete("/accounts/{accountId:guid}", async (
            Guid householdId,
            Guid accountId,
            ClaimsPrincipal principal,
            LedgerService service,
            CancellationToken cancellationToken) =>
        {
            await service.ArchiveAccountAsync(householdId, accountId, UserId(principal), cancellationToken);
            return Results.NoContent();
        }).WithName("ArchiveAccount");

        ledger.MapGet("/history", async (
            Guid householdId,
            int? limit,
            LedgerService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetHistoryAsync(householdId, limit ?? 100, cancellationToken)))
            .WithName("GetLedgerHistory");

        ledger.MapPost("/income", async (
            Guid householdId,
            PostIncomeRequest request,
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
                    request.IdempotencyKey,
                    request.Description),
                cancellationToken);
            return WriteResult(result);
        }).WithName("PostIncome");

        ledger.MapPost("/expenses", async (
            Guid householdId,
            PostExpenseRequest request,
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
                    request.IdempotencyKey,
                    request.Description),
                cancellationToken);
            return WriteResult(result);
        }).WithName("PostExpense");

        ledger.MapPost("/transfers", async (
            Guid householdId,
            PostTransferRequest request,
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
                    request.IdempotencyKey,
                    request.Description),
                cancellationToken);
            return WriteResult(result);
        }).WithName("PostTransfer");

        ledger.MapPost("/transactions/{transactionId:guid}/reversals", async (
            Guid householdId,
            Guid transactionId,
            ReverseTransactionRequest request,
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
                    request.IdempotencyKey,
                    request.Description),
                cancellationToken);
            return WriteResult(result);
        }).WithName("ReverseTransaction");

        ledger.MapGet("/balances", async (
            Guid householdId,
            LedgerService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetBalancesAsync(householdId, cancellationToken)))
            .WithName("GetAccountBalances");

        ledger.MapGet("/reconciliation", async (
            Guid householdId,
            LedgerService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.ReconcileAsync(householdId, cancellationToken)))
            .WithName("ReconcileLedger");

        return endpoints;
    }

    private static IResult WriteResult(LedgerWriteResult result) =>
        result.Replayed
            ? Results.Ok(result)
            : Results.Created($"/api/v1/ledger/transactions/{result.TransactionId}", result);

    private static Guid UserId(ClaimsPrincipal principal) =>
        Guid.Parse(principal.FindFirstValue("sub")!);

    public sealed record PostIncomeRequest(
        Guid AccountId,
        Guid CategoryId,
        long AmountCents,
        string Currency,
        DateOnly OccurredOn,
        Guid IdempotencyKey,
        string? Description);

    public sealed record CreateAccountRequest(
        Guid Id,
        string Name,
        AccountKind Kind,
        string Currency,
        long InitialBalanceCents,
        DateOnly OpeningDate,
        Guid IdempotencyKey);

    public sealed record PostExpenseRequest(
        Guid AccountId,
        Guid CategoryId,
        long AmountCents,
        string Currency,
        DateOnly OccurredOn,
        Guid IdempotencyKey,
        string? Description);

    public sealed record PostTransferRequest(
        Guid SourceAccountId,
        Guid DestinationAccountId,
        long AmountCents,
        string Currency,
        DateOnly OccurredOn,
        Guid IdempotencyKey,
        string? Description);

    public sealed record ReverseTransactionRequest(
        DateOnly OccurredOn,
        Guid IdempotencyKey,
        string? Description);
}
