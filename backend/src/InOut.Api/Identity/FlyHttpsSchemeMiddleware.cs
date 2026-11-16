using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;

namespace InOut.Api.Identity;

/// <summary>
/// OpenIddict requires HTTPS. Fly terminates TLS at the edge and talks HTTP to
/// the VM. X-Forwarded-Proto is taken only from Fly 6PN or loopback; public
/// internet peers cannot set the scheme. Internal BFF hosts on 6PN without a
/// proto header are also treated as https. X-Forwarded-For is not enabled.
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
        var remote = http.Connection.RemoteIpAddress;
        if (!ClientIp.IsTrustedFlyProxy(remote))
        {
            return false;
        }

        if (configuration.GetValue("Deployment:TrustFlyProxy", false) && ForwardedProtoIsHttps(http))
        {
            return true;
        }

        var hosts = configuration.GetSection("Auth:InternalHttpHosts").Get<string[]>() ?? [];
        var host = http.Request.Host.Host;
        return hosts.Contains(host, StringComparer.OrdinalIgnoreCase);
    }

    internal static bool ForwardedProtoIsHttps(HttpContext http)
    {
        var proto = http.Request.Headers["X-Forwarded-Proto"].ToString();
        return proto.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Any(value => string.Equals(value, "https", StringComparison.OrdinalIgnoreCase));
    }
}

public static class FlyForwardedHeaders
{
    public static readonly System.Net.IPNetwork PrivateNetwork = new(IPAddress.Parse("fdaa::"), 16);

    public static void Configure(ForwardedHeadersOptions options, bool trustFlyProxy)
    {
        options.ForwardLimit = 1;
        if (!trustFlyProxy)
        {
            options.ForwardedHeaders = ForwardedHeaders.None;
            return;
        }

        options.ForwardedHeaders = ForwardedHeaders.XForwardedProto;
        options.KnownIPNetworks.Add(PrivateNetwork);
    }
}
