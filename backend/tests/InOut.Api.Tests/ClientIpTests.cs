using System.Security.Cryptography;
using System.Text;
using InOut.Api.Identity;
using Xunit;

namespace InOut.Api.Tests;

public sealed class ClientIpTests
{
    [Fact]
    public void ForwardedIpRequiresMatchingHmac()
    {
        const string key = "bff-ip-key";
        const string ip = "203.0.113.10";
        var mac = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes(ip)))
            .ToLowerInvariant();
        Assert.False(ClientIp.MacMatches(key, ip, ""));
        Assert.False(ClientIp.MacMatches(key, ip, "deadbeef"));
        Assert.False(ClientIp.MacMatches(key, "198.51.100.9", mac));
        Assert.True(ClientIp.MacMatches(key, ip, mac));
        Assert.True(ClientIp.MacMatches(key, ip, mac.ToUpperInvariant()));
    }
}
