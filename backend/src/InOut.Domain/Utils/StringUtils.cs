namespace InOut.Domain.Utils;

public static class StringUtils
{
    public static string? TrimToNull(string? value)
    {
        var normalized = value?.Trim();
        return string.IsNullOrEmpty(normalized) ? null : normalized;
    }

    public static string TrimOrEmpty(string? value) => value?.Trim() ?? string.Empty;

    public static string NormalizeLower(string? value) => TrimOrEmpty(value).ToLowerInvariant();

    public static string NormalizeUpper(string? value) => TrimOrEmpty(value).ToUpperInvariant();
}
