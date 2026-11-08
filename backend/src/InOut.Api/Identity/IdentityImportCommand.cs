using System.Text.Json;
using InOut.Application.Identity;

namespace InOut.Api.Identity;

public static class IdentityImportCommand
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    public static async Task<byte[]> ReadLocalAsync(string path, CancellationToken cancellationToken)
    {
        if (path.Contains("://", StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                "Import reads a local file only. Remote export URLs are refused.");
        }

        var full = Path.GetFullPath(path);
        if (!File.Exists(full))
        {
            throw new FileNotFoundException("Import file was not found.", full);
        }

        return await File.ReadAllBytesAsync(full, cancellationToken);
    }

    public static IReadOnlyList<ExportedIdentityUser> Parse(byte[] utf8)
    {
        var rows = JsonSerializer.Deserialize<List<ExportedIdentityUser>>(utf8, JsonOptions)
            ?? throw new InvalidOperationException("Import file did not contain a user array.");
        return rows;
    }
}
