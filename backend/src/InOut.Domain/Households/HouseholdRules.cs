using InOut.Domain.Utils;

namespace InOut.Domain.Households;

public static class HouseholdRules
{
    public const int MaximumMembers = 2;
    public static readonly TimeSpan InvitationLifetime = TimeSpan.FromHours(24);

    public static string NormalizeName(string? name)
    {
        var normalized = StringUtils.TrimOrEmpty(name);
        if (normalized.Length is < 1 or > 80)
        {
            throw new HouseholdRuleException(
                HouseholdErrorCodes.InvalidHouseholdName,
                "Household name must contain between 1 and 80 characters.");
        }

        return normalized;
    }

    public static string NormalizeInviteCode(string? code)
    {
        var normalized = StringUtils.NormalizeLower(code);
        if (normalized.Length != 48 || normalized.Any(character => !char.IsAsciiHexDigit(character)))
        {
            throw new HouseholdRuleException(HouseholdErrorCodes.InvalidInvite, "Invalid or expired invitation.");
        }

        return normalized;
    }
}

public sealed class HouseholdRuleException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}
