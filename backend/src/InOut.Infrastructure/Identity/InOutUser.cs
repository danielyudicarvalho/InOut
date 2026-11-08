using Microsoft.AspNetCore.Identity;

namespace InOut.Infrastructure.Identity;

public sealed class InOutUser : IdentityUser<Guid>
{
    public string? DisplayName { get; set; }

    public DateTimeOffset? BannedUntil { get; set; }

    public bool MfaReenrollmentRequired { get; set; }
}
