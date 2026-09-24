namespace InOut.Domain.Financial;

public static class FinancialErrorCodes
{
    public const string AccountConflict = "account_conflict";
    public const string AccountNotFound = "account_not_found";
    public const string CurrencyMismatch = "currency_mismatch";
    public const string DescriptionTooLong = "description_too_long";
    public const string InvalidAccount = "invalid_account";
    public const string InvalidAccountId = "invalid_account_id";
    public const string InvalidAccountName = "invalid_account_name";
    public const string InvalidAmount = "invalid_amount";
    public const string InvalidCategory = "invalid_category";
    public const string CategoryConflict = "category_conflict";
    public const string CategoryNotFound = "category_not_found";
    public const string CategoryHasActiveChildren = "category_has_active_children";
    public const string InvalidCurrency = "invalid_currency";
    public const string InvalidInitialBalance = "invalid_initial_balance";
    public const string InvalidPeriod = "invalid_period";
    public const string NegativeMoney = "negative_money";
    public const string ReversalOfReversal = "reversal_of_reversal";
    public const string SameTransferAccount = "same_transfer_account";
    public const string TransactionNotFound = "transaction_not_found";
    public const string TransactionNotReversible = "transaction_not_reversible";
    public const string TransactionWithoutEntries = "transaction_without_entries";
}
