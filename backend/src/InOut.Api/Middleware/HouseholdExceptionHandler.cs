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
            HouseholdErrorCodes.OwnerRequired => StatusCodes.Status403Forbidden,
            HouseholdErrorCodes.HouseholdFull or HouseholdErrorCodes.AlreadyMember =>
                StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest
        };
        httpContext.Response.StatusCode = status;
        await httpContext.Response.WriteAsJsonAsync(
            new ProblemDetails
            {
                Status = status,
                Title = householdException.Message,
                Extensions = { [ApiContract.ProblemFields.Code] = householdException.Code }
            },
            cancellationToken);
        return true;
    }
}
