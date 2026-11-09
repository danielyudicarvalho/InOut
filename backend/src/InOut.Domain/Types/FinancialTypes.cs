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
    Active = 4,
    Deprecated = 5,
    Archived = 6,
}

public enum IncomeSourceStatus
{
    Active = 7,
    Archived = 8,
}

public enum GoalStatus
{
    Active = 9,
    Paused = 10,
    Completed = 11,
    Archived = 12,
}

public enum GoalAllocationKind
{
    Contribution,
    Reversal,
}

public enum GoalAllocationOrigin
{
    Recorded,
    Opening,
}

public enum RecurringPlanStatus
{
    Active = 13,
    Paused = 14,
    Archived = 15,
}

public enum FinancialProjectStatus
{
    Active = 16,
    Closed = 17,
}

public enum AgendaState
{
    Expected,
    Realized,
    Overdue,
}
