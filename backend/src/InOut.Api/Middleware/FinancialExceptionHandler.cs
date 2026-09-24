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
            FinancialErrorCodes.TransactionNotFound or FinancialErrorCodes.CategoryNotFound or FinancialErrorCodes.IncomeSourceNotFound or FinancialErrorCodes.RecurringPlanNotFound => StatusCodes.Status404NotFound,
            FinancialErrorCodes.TransactionNotReversible or
            IdempotencyErrorCodes.Conflict or
            IdempotencyErrorCodes.InProgress or
            FinancialErrorCodes.AccountConflict or
            FinancialErrorCodes.CategoryConflict or
            FinancialErrorCodes.IncomeSourceConflict or
            FinancialErrorCodes.RecurringPlanConflict or
            FinancialErrorCodes.CategoryHasActiveChildren => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest
        };
        httpContext.Response.StatusCode = status;
        if (code == IdempotencyErrorCodes.InProgress)
        {
            httpContext.Response.Headers[ApiContract.Headers.RetryAfter] =
                ApiContract.HeaderValues.RetryAfterFiveSeconds;
        }
        await httpContext.Response.WriteAsJsonAsync(
            new ProblemDetails
            {
                Status = status,
                Title = message,
                Extensions = { [ApiContract.ProblemFields.Code] = code }
            },
            cancellationToken);
        return true;
    }
}
