namespace InOut.Domain.Financial;

public enum AccountKind
{
    Cash,
    Checking,
    Savings,
    Investment,
    Other
}

public enum EntryDirection
{
    Debit,
    Credit
}

public enum FinancialFlow
{
    Income,
    Expense
}

public enum FinancialTransactionKind
{
    OpeningBalance,
    Income,
    Expense,
    Transfer,
    Reversal
}

public enum FinancialTransactionStatus
{
    Draft,
    Posted,
    Reversed,
    Voided
}

public enum DefaultCategoryKind
{
    Salary,
    OtherIncome,
    Housing,
    Food,
    Transport,
    OtherExpense
}
