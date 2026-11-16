using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;

namespace InOut.Api.Identity;

public static class ClientIp
{
    public static string Resolve(HttpContext http)
    {
        var configuration = http.RequestServices.GetService<IConfiguration>();
        var key = configuration?["Auth:BffIpKey"];
        var forwarded = http.Request.Headers["x-inout-client-ip"].ToString();
        var mac = http.Request.Headers["x-inout-client-ip-mac"].ToString();
        if (!string.IsNullOrWhiteSpace(key) &&
            !string.IsNullOrWhiteSpace(forwarded) &&
            MacMatches(key, forwarded, mac))
        {
            return forwarded.Trim();
        }

        return http.Connection.RemoteIpAddress?.ToString() ?? "local";
    }

    public static bool MacMatches(string key, string ip, string mac)
    {
        if (string.IsNullOrEmpty(mac))
        {
            return false;
        }

        var expected = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes(ip)))
            .ToLowerInvariant();
        var left = Encoding.UTF8.GetBytes(mac.Trim().ToLowerInvariant());
        var right = Encoding.UTF8.GetBytes(expected);
        return left.Length == right.Length && CryptographicOperations.FixedTimeEquals(left, right);
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
}
