using System.Diagnostics;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using OpenTelemetry.Trace;

namespace InOut.Api.Middleware;

public sealed class UnhandledExceptionHandler(ILogger<UnhandledExceptionHandler> logger) : IExceptionHandler
{
    private static readonly Action<ILogger, string, string, string, Exception?> LogFailure =
        LoggerMessage.Define<string, string, string>(LogLevel.Error, new EventId(1002, "UnhandledRequestFailure"),
            "Unhandled request failure: {ExceptionType} | TraceId: {TraceId} | SqlState: {SqlState}");

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var traceId = Activity.Current?.TraceId.ToString() ?? httpContext.TraceIdentifier;
        var sqlState = (exception.InnerException as PostgresException)?.SqlState ?? "N/A";

        if (Activity.Current != null)
        {
            Activity.Current.SetStatus(ActivityStatusCode.Error, exception.Message);
            Activity.Current.AddException(exception);
        }

        LogFailure(logger, exception.GetType().Name, traceId, sqlState, exception);
        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await httpContext.Response.WriteAsJsonAsync(
            new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "An unexpected error occurred. Use the correlation ID to report it.",
                Extensions = { ["traceId"] = traceId }
            },
            cancellationToken);
        return true;
    }
}
