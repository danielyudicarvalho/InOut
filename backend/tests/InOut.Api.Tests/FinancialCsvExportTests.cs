using System.Text;
using InOut.Api.Financial;
using InOut.Application.Financial.Export;
using InOut.Application.Security;
using InOut.Domain.Financial;
using InOut.Domain.Households;
using Xunit;

namespace InOut.Api.Tests;

public sealed class FinancialCsvExportTests
{
    [Fact]
    public async Task RejectsOtherHouseholdBeforeReadingAnyFinancialData()
    {
        var reader = new RecordingReader();
        var export = new ExportFinancialData(new MembershipReader(false), reader);

        var exception = await Assert.ThrowsAsync<HouseholdRuleException>(() =>
            export.ExecuteAsync(Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None));

        Assert.Equal(HouseholdErrorCodes.MembershipRequired, exception.Code);
        Assert.False(reader.WasCalled);
    }

    [Fact]
    public async Task SendsActorAndHouseholdToRlsReader()
    {
        var reader = new RecordingReader();
        var export = new ExportFinancialData(new MembershipReader(true), reader);
        var actor = Guid.NewGuid();
        var household = Guid.NewGuid();

        await export.ExecuteAsync(actor, household, CancellationToken.None);

        Assert.Equal(actor, reader.Actor);
        Assert.Equal(household, reader.Household);
    }

    [Fact]
    public void CsvPreservesLedgerIdentifiersDatesAndCentsAndEscapesSpreadsheetText()
    {
        var transactionId = Guid.NewGuid();
        var reversedId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();
        var entryId = Guid.NewGuid();
        var rows = new[]
        {
            FinancialExportRow.FromHistory(transactionId, FinancialTransactionKind.Reversal, FinancialTransactionStatus.Posted,
                new DateOnly(2026, 9, 24), new DateTimeOffset(2026, 9, 24, 8, 0, 0, TimeSpan.Zero),
                new DateTimeOffset(2026, 9, 24, 8, 1, 0, TimeSpan.Zero),
                "=SUM(1;2)\n\"anotação\"", reversedId, null,
                new LedgerEntry(entryId, Guid.NewGuid(), categoryId, EntryDirection.Debit,
                    Money.Positive(12345, "BRL")),
                "Conta; principal", "Alimentação", null, FinancialFlow.Expense)
        };

        var bytes = FinancialCsvWriter.Write(rows);
        var csv = Encoding.UTF8.GetString(bytes);

        Assert.StartsWith("\uFEFFtransaction_id;kind;status;occurred_on;", csv);
        Assert.Contains(transactionId.ToString(), csv);
        Assert.Contains(reversedId.ToString(), csv);
        Assert.Contains(categoryId.ToString(), csv);
        Assert.Contains("2026-09-24", csv);
        Assert.Contains("\"12345\"", csv);
        Assert.Contains("\"'=SUM(1;2)\n\"\"anotação\"\"\"", csv);
        Assert.Contains("\"Conta; principal\"", csv);
        Assert.EndsWith("\r\n", csv);
    }

    private sealed class MembershipReader(bool isMember) : IHouseholdMembershipReader
    {
        public Task<bool> IsMemberAsync(Guid userId, Guid householdId, CancellationToken cancellationToken) =>
            Task.FromResult(isMember);
    }

    private sealed class RecordingReader : IFinancialExportReader
    {
        public bool WasCalled { get; private set; }
        public Guid Actor { get; private set; }
        public Guid Household { get; private set; }

        public Task<IReadOnlyList<FinancialExportRow>> ReadAsync(
            Guid actorUserId, Guid householdId, CancellationToken cancellationToken)
        {
            WasCalled = true;
            Actor = actorUserId;
            Household = householdId;
            return Task.FromResult<IReadOnlyList<FinancialExportRow>>([]);
        }
    }
}
