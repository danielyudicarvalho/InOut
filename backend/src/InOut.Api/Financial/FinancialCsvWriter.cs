using System.Globalization;
using System.Text;
using InOut.Application.Financial.Export;

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
                row.TransactionId.ToString(), row.Kind, row.Status,
                row.OccurredOn.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                row.CreatedAt.ToString("O", CultureInfo.InvariantCulture),
                row.PostedAt?.ToString("O", CultureInfo.InvariantCulture),
                SafeText(row.Description), row.ReversalOf?.ToString(),
                row.OpeningAccountId?.ToString(), row.EntryId?.ToString(),
                row.AccountId?.ToString(), SafeText(row.AccountName), row.Currency,
                row.CategoryId?.ToString(), SafeText(row.CategoryName),
                row.CategoryParentId?.ToString(), row.CategoryFlow, row.Direction,
                row.AmountCents?.ToString(CultureInfo.InvariantCulture)
            };
            csv.AppendJoin(';', fields.Select(Escape)).Append("\r\n");
        }

        var encoding = new UTF8Encoding(true);
        return [.. encoding.GetPreamble(), .. encoding.GetBytes(csv.ToString())];
    }

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
