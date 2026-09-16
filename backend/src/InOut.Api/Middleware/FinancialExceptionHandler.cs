using InOut.Domain.Financial;
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
        if (exception is not FinancialRuleException financialException)
        {
            return false;
        }

        var status = financialException.Code switch
        {
            "transaction_not_found" => StatusCodes.Status404NotFound,
            "transaction_not_reversible" or
            "idempotency_conflict" or
            "account_conflict" => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest
        };
        httpContext.Response.StatusCode = status;
        await httpContext.Response.WriteAsJsonAsync(
            new ProblemDetails
            {
                Status = status,
                Title = financialException.Message,
                Extensions = { ["code"] = financialException.Code }
            },
            cancellationToken);
        return true;
    }
}
