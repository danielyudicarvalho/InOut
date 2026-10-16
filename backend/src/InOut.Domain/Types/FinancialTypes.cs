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

public enum AccountStatus
{
    Active = 1,
    Frozen = 2,
    Archived = 3,
}

public enum CategoryStatus
{
    Active = 1,
    Deprecated = 2,
    Archived = 3,
}

public enum IncomeSourceStatus
{
    Active = 1,
    Archived = 2,
}

public enum GoalStatus
{
    Active = 1,
    Paused = 2,
    Completed = 3,
    Archived = 4,
}

public enum RecurringPlanStatus
{
    Active = 1,
    Paused = 2,
    Archived = 3,
}
