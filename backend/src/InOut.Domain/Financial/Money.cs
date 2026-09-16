using InOut.Domain.Utils;

namespace InOut.Domain.Financial;

public readonly record struct Money
{
    public Money(long cents, string currency = "BRL")
    {
        if (cents < 0)
        {
            throw new FinancialRuleException("invalid_amount", "Money cannot be negative.");
        }

        var normalizedCurrency = StringUtils.NormalizeUpper(currency);
        if (normalizedCurrency.Length != 3 ||
            normalizedCurrency.Any(character => character is < 'A' or > 'Z'))
        {
            throw new FinancialRuleException("invalid_currency", "Currency must be a three-letter ISO code.");
        }

        Cents = cents;
        Currency = normalizedCurrency;
    }

    public long Cents { get; }

    public string Currency { get; }

    public static Money Positive(long cents, string currency = "BRL")
    {
        if (cents <= 0)
        {
            throw new FinancialRuleException("invalid_amount", "Amount must be greater than zero.");
        }

        return new Money(cents, currency);
    }

    public Money Add(Money other)
    {
        EnsureSameCurrency(other);
        return new Money(checked(Cents + other.Cents), Currency);
    }

    public Money Subtract(Money other)
    {
        EnsureSameCurrency(other);
        if (other.Cents > Cents)
        {
            throw new FinancialRuleException("negative_money", "The operation would produce negative Money.");
        }

        return new Money(Cents - other.Cents, Currency);
    }

    private void EnsureSameCurrency(Money other)
    {
        if (!string.Equals(Currency, other.Currency, StringComparison.Ordinal))
        {
            throw new FinancialRuleException("currency_mismatch", "Money currencies must match.");
        }
    }
}

public sealed class FinancialRuleException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}
