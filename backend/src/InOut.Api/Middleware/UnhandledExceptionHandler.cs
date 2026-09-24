using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace InOut.Api.Middleware;

public sealed class UnhandledExceptionHandler(ILogger<UnhandledExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        // Exception messages and stack traces can contain SQL, tokens or financial descriptions.
        logger.LogError("Unhandled request failure: {ExceptionType}", exception.GetType().Name);
        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await httpContext.Response.WriteAsJsonAsync(
            new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "An unexpected error occurred. Use the correlation ID to report it."
            },
            cancellationToken);
        return true;
    }
}
