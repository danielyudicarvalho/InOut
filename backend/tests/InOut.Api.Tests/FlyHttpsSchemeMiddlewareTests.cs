using System.Net;
using InOut.Api.Identity;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace InOut.Api.Tests;

public sealed class FlyHttpsSchemeMiddlewareTests
{
    [Fact]
    public void ConfigureTrustsProtoFromFlyPrivateNetworkOnly()
    {
        var options = new ForwardedHeadersOptions();
        FlyForwardedHeaders.Configure(options, trustFlyProxy: true);
        Assert.Equal(ForwardedHeaders.XForwardedProto, options.ForwardedHeaders);
        Assert.Equal(1, options.ForwardLimit);
        Assert.False(options.ForwardedHeaders.HasFlag(ForwardedHeaders.XForwardedFor));
        Assert.Contains(FlyForwardedHeaders.PrivateNetwork, options.KnownIPNetworks);
        Assert.Contains(
            options.KnownIPNetworks,
            network => network.Contains(IPAddress.Parse("fdaa:1:2:3::4")));
        Assert.DoesNotContain(
            options.KnownIPNetworks,
            network => network.Contains(IPAddress.Parse("198.51.100.10")));

        var closed = new ForwardedHeadersOptions();
        FlyForwardedHeaders.Configure(closed, trustFlyProxy: false);
        Assert.Equal(ForwardedHeaders.None, closed.ForwardedHeaders);
    }

    [Fact]
    public async Task PublicFlyHostUsesForwardedProtoFromProxy()
    {
        var http = await InvokeAsync(
            host: "inout-api.fly.dev",
            remote: IPAddress.Parse("fdaa:0:0:0::1"),
            proto: "https",
            trustFlyProxy: true,
            internalHost: "inout-api.internal");
        Assert.Equal("https", http.Request.Scheme);
    }

    [Fact]
    public async Task PublicInternetCannotSetForwardedProto()
    {
        var http = await InvokeAsync(
            host: "inout-api.fly.dev",
            remote: IPAddress.Parse("198.51.100.10"),
            proto: "https",
            trustFlyProxy: true,
            internalHost: "inout-api.internal");
        Assert.Equal("http", http.Request.Scheme);
    }

    [Fact]
    public async Task InternalHostFromFlyPrivateNetworkIsHttpsWithoutProto()
    {
        var http = await InvokeAsync(
            host: "inout-api.internal",
            remote: IPAddress.Parse("fdaa:0:0:0::1"),
            proto: null,
            trustFlyProxy: true,
            internalHost: "inout-api.internal");
        Assert.Equal("https", http.Request.Scheme);
    }

    [Fact]
    public async Task PublicHostWithoutTrustFlagStaysHttp()
    {
        var http = await InvokeAsync(
            host: "inout-api.fly.dev",
            remote: IPAddress.Parse("fdaa:0:0:0::1"),
            proto: "https",
            trustFlyProxy: false,
            internalHost: "inout-api.internal");
        Assert.Equal("http", http.Request.Scheme);
    }

    private static async Task<DefaultHttpContext> InvokeAsync(
        string host,
        IPAddress remote,
        string? proto,
        bool trustFlyProxy,
        string internalHost)
    {
        var http = new DefaultHttpContext();
        http.Request.Scheme = "http";
        http.Request.Host = new HostString(host);
        http.Connection.RemoteIpAddress = remote;
        if (proto is not null)
        {
            http.Request.Headers["X-Forwarded-Proto"] = proto;
        }

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Deployment:TrustFlyProxy"] = trustFlyProxy ? "true" : "false",
                ["Auth:InternalHttpHosts:0"] = internalHost
            })
            .Build();
        var middleware = new FlyHttpsSchemeMiddleware(_ => Task.CompletedTask, config);
        await middleware.Invoke(http);
        return http;
    }
}
