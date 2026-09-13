using InOut.Domain.Households;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace InOut.Api.Middleware;

public sealed class HouseholdExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is not HouseholdRuleException householdException)
        {
            return false;
        }

        var status = householdException.Code switch
        {
            "owner_required" => StatusCodes.Status403Forbidden,
            "household_full" or "already_member" => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest
        };
        httpContext.Response.StatusCode = status;
        await httpContext.Response.WriteAsJsonAsync(
            new ProblemDetails
            {
                Status = status,
                Title = householdException.Message,
                Extensions = { ["code"] = householdException.Code }
            },
            cancellationToken);
        return true;
    }
}
