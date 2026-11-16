using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using InOut.Api.Identity;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace InOut.Api.Tests;

public sealed class ClientIpTests
{
    [Fact]
    public void ForwardedIpRequiresFreshTimestampNonceMac()
    {
        const string key = "bff-ip-key";
        const string ip = "203.0.113.10";
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture);
        const string nonce = "n1";
        var mac = ClientIp.ComputeMac(key, ip, timestamp, nonce);
        Assert.True(ClientIp.MacMatches(key, ip, timestamp, nonce, mac));
        Assert.True(ClientIp.MacMatches(key, ip, timestamp, nonce, mac.ToUpperInvariant()));
        Assert.False(ClientIp.MacMatches(key, ip, timestamp, nonce, "deadbeef"));
        Assert.False(ClientIp.MacMatches(key, "198.51.100.9", timestamp, nonce, mac));
        Assert.False(ClientIp.MacMatches(key, ip, timestamp, "other", mac));
        var stale = DateTimeOffset.UtcNow.AddMinutes(-5).ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture);
        var staleMac = ClientIp.ComputeMac(key, ip, stale, nonce);
        Assert.False(ClientIp.MacMatches(key, ip, stale, nonce, staleMac));
        var legacy = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes(ip)))
            .ToLowerInvariant();
        Assert.False(ClientIp.MacMatches(key, ip, legacy));
    }

    [Fact]
    public void ResolveTrustsFlyClientIpOnlyFromFlyProxyOrLoopback()
    {
        Assert.True(ClientIp.IsFlyPrivateNetwork(IPAddress.Parse("fdaa:1:2:3::4")));
        Assert.False(ClientIp.IsFlyPrivateNetwork(IPAddress.Parse("198.51.100.10")));
        Assert.Equal(
            "203.0.113.9",
            Resolve(
                remote: IPAddress.Parse("fdaa:0:0:0::1"),
                flyClient: "203.0.113.9"));
        Assert.Equal(
            "203.0.113.9",
            Resolve(
                remote: IPAddress.Loopback,
                flyClient: "203.0.113.9"));
        Assert.Equal(
            "198.51.100.10",
            Resolve(
                remote: IPAddress.Parse("198.51.100.10"),
                flyClient: "203.0.113.9"));
    }

    [Fact]
    public void ResolvePrefersHmacHeadersOverFlyClientIp()
    {
        const string key = "bff-ip-key";
        const string ip = "203.0.113.10";
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture);
        const string nonce = "abc";
        var http = CreateHttp(
            IPAddress.Parse("198.51.100.10"),
            flyClient: "198.51.100.9",
            key);
        http.Request.Headers["x-inout-client-ip"] = ip;
        http.Request.Headers["x-inout-client-ip-ts"] = timestamp;
        http.Request.Headers["x-inout-client-ip-nonce"] = nonce;
        http.Request.Headers["x-inout-client-ip-mac"] = ClientIp.ComputeMac(key, ip, timestamp, nonce);
        Assert.Equal(ip, ClientIp.Resolve(http));
    }

    private static string Resolve(IPAddress remote, string flyClient)
    {
        var http = CreateHttp(remote, flyClient, key: null);
        return ClientIp.Resolve(http);
    }

    private static DefaultHttpContext CreateHttp(IPAddress remote, string flyClient, string? key)
    {
        var http = new DefaultHttpContext();
        http.Connection.RemoteIpAddress = remote;
        http.Request.Headers["fly-client-ip"] = flyClient;
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Auth:BffIpKey"] = key
            })
            .Build();
        http.RequestServices = new ServiceCollection()
            .AddSingleton<IConfiguration>(config)
            .BuildServiceProvider();
        return http;
    }
}
