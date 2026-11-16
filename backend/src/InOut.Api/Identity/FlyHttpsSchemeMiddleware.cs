namespace InOut.Api.Identity;

/// <summary>
/// OpenIddict requires HTTPS. Fly private HTTP (BFF to API on 6PN) is not
/// globally exempt: only an allowlisted Host from a Fly private-network or
/// loopback address is treated as https. Forwarded headers are not consulted.
/// </summary>
public sealed class FlyHttpsSchemeMiddleware(RequestDelegate next, IConfiguration configuration)
{
    public Task Invoke(HttpContext http)
    {
        if (!http.Request.IsHttps && ShouldTreatAsHttps(http))
        {
            http.Request.Scheme = "https";
        }

        return next(http);
    }

    private bool ShouldTreatAsHttps(HttpContext http)
    {
        var hosts = configuration.GetSection("Auth:InternalHttpHosts").Get<string[]>() ?? [];
        if (hosts.Length == 0)
        {
            return false;
        }

        var host = http.Request.Host.Host;
        if (!hosts.Contains(host, StringComparer.OrdinalIgnoreCase))
        {
            return false;
        }

        var remote = http.Connection.RemoteIpAddress;
        return ClientIp.IsFlyPrivateNetwork(remote) || ClientIp.IsLoopback(remote);
    }
}
