using InOut.Domain.Financial;
using InOut.Application.Idempotency;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace InOut.Api.Middleware;

public sealed class FinancialExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (code, message) = exception switch
        {
            FinancialRuleException financial => (financial.Code, financial.Message),
            IdempotencyException idempotency => (idempotency.Code, idempotency.Message),
            _ => (null, null),
        };
        if (code is null)
        {
            return false;
        }

        var status = code switch
        {
            "transaction_not_found" => StatusCodes.Status404NotFound,
            "transaction_not_reversible" or
            "idempotency_conflict" or
            "idempotency_in_progress" or
            "account_conflict" => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest
        };
        httpContext.Response.StatusCode = status;
        if (code == "idempotency_in_progress")
        {
            httpContext.Response.Headers["Retry-After"] = "5";
        }
        await httpContext.Response.WriteAsJsonAsync(
            new ProblemDetails
            {
                Status = status,
                Title = message,
                Extensions = { ["code"] = code }
            },
            cancellationToken);
        return true;
    }
}
