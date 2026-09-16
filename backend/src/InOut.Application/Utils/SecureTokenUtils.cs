using System.Security.Cryptography;

namespace InOut.Application.Utils;

public static class SecureTokenUtils
{
    public static string GenerateHex(int byteCount)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(byteCount);
        return Convert.ToHexString(RandomNumberGenerator.GetBytes(byteCount)).ToLowerInvariant();
    }
}
