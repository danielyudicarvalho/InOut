using InOut.Application.Identity;
using InOut.Infrastructure.Identity;

namespace InOut.Api.Identity;

public sealed class IdentityIpBudgetMiddleware(RequestDelegate next)
{
    public async Task Invoke(HttpContext http, AuthAttemptBudget budget)
    {
        var path = http.Request.Path.Value ?? "";
        if (IsProtected(path))
        {
            var allowed = await budget.TryNetworkAsync(ClientIp.Resolve(http), http.RequestAborted);
            if (!allowed)
            {
                http.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                await http.Response.WriteAsJsonAsync(
                    new { code = IdentityCodes.RateLimited },
                    cancellationToken: http.RequestAborted);
                return;
            }
        }

        await next(http);
    }

    private static bool IsProtected(string path) =>
        path.StartsWith("/api/v1/identity", StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith("/account", StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith("/connect/token", StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith("/connect/authorize", StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith("/connect/logout", StringComparison.OrdinalIgnoreCase);
}
