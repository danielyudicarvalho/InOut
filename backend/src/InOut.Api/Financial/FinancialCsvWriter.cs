using System.Globalization;
using System.Text;
using InOut.Domain.Financial;

namespace InOut.Api.Financial;

public static class FinancialCsvWriter
{
    private const string Header = "transaction_id;kind;status;occurred_on;created_at;posted_at;description;reversal_of;opening_account_id;entry_id;account_id;account_name;currency;category_id;category_name;category_parent_id;category_flow;direction;amount_cents";

    public static byte[] Write(IReadOnlyList<FinancialExportRow> rows)
    {
        var csv = new StringBuilder(Header).Append("\r\n");
        foreach (var row in rows)
        {
            var fields = new[]
            {
                row.TransactionId.ToString(), Kind(row.Kind), EnumText(row.Status),
                row.OccurredOn.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                row.CreatedAt.ToString("O", CultureInfo.InvariantCulture),
                row.PostedAt?.ToString("O", CultureInfo.InvariantCulture),
                SafeText(row.Description), row.ReversalOf?.ToString(),
                row.OpeningAccountId?.ToString(), row.Entry?.Id.ToString(),
                row.Entry?.AccountId.ToString(), SafeText(row.AccountName), row.Entry?.Amount.Currency,
                row.Entry?.CategoryId?.ToString(), SafeText(row.CategoryName),
                row.CategoryParentId?.ToString(), row.CategoryFlow is { } flow ? EnumText(flow) : null,
                row.Entry is { } entry ? EnumText(entry.Direction) : null,
                row.Entry?.Amount.Cents.ToString(CultureInfo.InvariantCulture)
            };
            csv.AppendJoin(';', fields.Select(Escape)).Append("\r\n");
        }

        var encoding = new UTF8Encoding(true);
        return [.. encoding.GetPreamble(), .. encoding.GetBytes(csv.ToString())];
    }

    private static string Kind(FinancialTransactionKind kind) =>
        kind is FinancialTransactionKind.OpeningBalance ? "opening_balance" : EnumText(kind);

    private static string EnumText<T>(T value) where T : struct, Enum =>
        value.ToString().ToLowerInvariant();

    private static string? SafeText(string? value)
    {
        if (value is null) return null;
        var start = value.TrimStart();
        return start.Length > 0 && (start[0] is '=' or '+' or '-' or '@' ||
            value.StartsWith('\t') || value.StartsWith('\r') || value.StartsWith('\n'))
            ? "'" + value
            : value;
    }

    private static string Escape(string? value) =>
        value is null ? string.Empty : "\"" + value.Replace("\"", "\"\"", StringComparison.Ordinal) + "\"";
}
