using System.Text;

namespace InOut.Infrastructure.Identity;

public enum LegacyPasswordStatus
{
    NotLegacy,
    Match,
    Mismatch,
    RequiresReset
}

/// <summary>
/// Verifies password hashes produced by the previous hosted auth service.
/// The previous verifier accepts only the $2a$ and $2b$ prefixes and rejects
/// passwords whose UTF-8 form is longer than 72 bytes instead of truncating
/// them. Argon2 and Firebase scrypt hashes are recognized and refused so they
/// are kept for a reset instead of being treated as a successful password.
/// </summary>
public static class LegacyPasswordVerifier
{
    public const int BcryptMaxUtf8Bytes = 72;

    public static LegacyPasswordStatus Verify(string? hash, string? password)
    {
        if (string.IsNullOrEmpty(hash) || password is null)
        {
            return LegacyPasswordStatus.Mismatch;
        }

        if (hash.StartsWith("$argon2", StringComparison.Ordinal) ||
            hash.StartsWith("$fbscrypt$", StringComparison.Ordinal) ||
            hash.StartsWith("$2y$", StringComparison.Ordinal) ||
            hash.StartsWith("$2x$", StringComparison.Ordinal))
        {
            return LegacyPasswordStatus.RequiresReset;
        }

        if (!IsSupportedBcrypt(hash))
        {
            return LegacyPasswordStatus.NotLegacy;
        }

        if (Encoding.UTF8.GetByteCount(password) > BcryptMaxUtf8Bytes)
        {
            return LegacyPasswordStatus.Mismatch;
        }

        try
        {
            return BCrypt.Net.BCrypt.Verify(password, hash)
                ? LegacyPasswordStatus.Match
                : LegacyPasswordStatus.Mismatch;
        }
        catch (BCrypt.Net.SaltParseException)
        {
            return LegacyPasswordStatus.RequiresReset;
        }
    }

    public static bool IsSupportedBcrypt(string hash) =>
        hash.Length == 60 &&
        (hash.StartsWith("$2a$", StringComparison.Ordinal) ||
         hash.StartsWith("$2b$", StringComparison.Ordinal)) &&
        char.IsAsciiDigit(hash[4]) &&
        char.IsAsciiDigit(hash[5]) &&
        hash[6] == '$';
}
