using System.Globalization;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;

namespace InOut.Api.Identity;

public static class ClientIp
{
    public static readonly TimeSpan MacValidity = TimeSpan.FromSeconds(30);

    public static string Resolve(HttpContext http)
    {
        var configuration = http.RequestServices.GetService<IConfiguration>();
        var key = configuration?["Auth:BffIpKey"];
        var forwarded = http.Request.Headers["x-inout-client-ip"].ToString();
        var mac = http.Request.Headers["x-inout-client-ip-mac"].ToString();
        var timestamp = http.Request.Headers["x-inout-client-ip-ts"].ToString();
        var nonce = http.Request.Headers["x-inout-client-ip-nonce"].ToString();
        if (!string.IsNullOrWhiteSpace(key) &&
            !string.IsNullOrWhiteSpace(forwarded) &&
            MacMatches(key, forwarded, timestamp, nonce, mac))
        {
            return forwarded.Trim();
        }

        var remote = http.Connection.RemoteIpAddress;
        var flyClient = http.Request.Headers["fly-client-ip"].ToString();
        if (!string.IsNullOrWhiteSpace(flyClient) && IsTrustedFlyProxy(remote))
        {
            return flyClient.Trim();
        }

        return remote?.ToString() ?? "local";
    }

    public static bool IsTrustedFlyProxy(IPAddress? address) =>
        IsFlyPrivateNetwork(address) || IsLoopback(address);

    public static bool MacMatches(string key, string ip, string mac) =>
        MacMatches(key, ip, UnixSeconds(DateTimeOffset.UtcNow), "legacy", mac);

    public static bool MacMatches(
        string key,
        string ip,
        string timestamp,
        string nonce,
        string mac)
    {
        if (string.IsNullOrEmpty(mac) ||
            string.IsNullOrWhiteSpace(ip) ||
            string.IsNullOrWhiteSpace(timestamp) ||
            string.IsNullOrWhiteSpace(nonce))
        {
            return false;
        }

        if (!long.TryParse(timestamp, NumberStyles.Integer, CultureInfo.InvariantCulture, out var seconds))
        {
            return false;
        }

        var issued = DateTimeOffset.FromUnixTimeSeconds(seconds);
        if ((DateTimeOffset.UtcNow - issued).Duration() > MacValidity)
        {
            return false;
        }

        var material = Encoding.UTF8.GetBytes($"{ip.Trim()}\n{timestamp.Trim()}\n{nonce.Trim()}");
        var expected = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(key), material))
            .ToLowerInvariant();
        var left = Encoding.UTF8.GetBytes(mac.Trim().ToLowerInvariant());
        var right = Encoding.UTF8.GetBytes(expected);
        return left.Length == right.Length && CryptographicOperations.FixedTimeEquals(left, right);
    }

    public static string ComputeMac(string key, string ip, string timestamp, string nonce)
    {
        var material = Encoding.UTF8.GetBytes($"{ip}\n{timestamp}\n{nonce}");
        return Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(key), material))
            .ToLowerInvariant();
    }

    public static bool IsFlyPrivateNetwork(IPAddress? address)
    {
        if (address is null)
        {
            return false;
        }

        if (address.IsIPv4MappedToIPv6)
        {
            address = address.MapToIPv4();
        }

        return address.AddressFamily == AddressFamily.InterNetworkV6 &&
               address.GetAddressBytes() is [0xfd, 0xaa, ..];
    }

    public static bool IsLoopback(IPAddress? address) =>
        address is not null && IPAddress.IsLoopback(address);

    private static string UnixSeconds(DateTimeOffset value) =>
        value.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture);
}
