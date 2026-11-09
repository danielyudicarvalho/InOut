using Microsoft.AspNetCore.Identity;

namespace InOut.Infrastructure.Identity;

public sealed class InOutPasswordHasher : IPasswordHasher<InOutUser>
{
    private readonly PasswordHasher<InOutUser> identity = new();

    public string HashPassword(InOutUser user, string password) =>
        identity.HashPassword(user, password);

    public PasswordVerificationResult VerifyHashedPassword(
        InOutUser user,
        string hashedPassword,
        string providedPassword)
    {
        var legacy = LegacyPasswordVerifier.Verify(hashedPassword, providedPassword);
        return legacy switch
        {
            LegacyPasswordStatus.Match => PasswordVerificationResult.SuccessRehashNeeded,
            LegacyPasswordStatus.Mismatch => PasswordVerificationResult.Failed,
            LegacyPasswordStatus.RequiresReset => PasswordVerificationResult.Failed,
            _ => identity.VerifyHashedPassword(user, hashedPassword, providedPassword)
        };
    }
}
