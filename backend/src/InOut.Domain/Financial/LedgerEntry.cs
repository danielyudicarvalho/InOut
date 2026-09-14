namespace InOut.Domain.Financial;

public enum EntryDirection
{
    Debit,
    Credit
}

public sealed record LedgerEntry(
    Guid Id,
    Guid AccountId,
    Guid? CategoryId,
    EntryDirection Direction,
    Money Amount)
{
    public LedgerEntry Reverse() => this with
    {
        Id = Guid.NewGuid(),
        Direction = Direction is EntryDirection.Debit
            ? EntryDirection.Credit
            : EntryDirection.Debit,
    };
}
