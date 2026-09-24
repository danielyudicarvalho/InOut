namespace InOut.Application.Idempotency;

public enum IdempotencyOperation
{
    CreateAccount,
    CreateCategory,
    CreateRecurringPlan,
    PostIncome,
    PostExpense,
    PostTransfer,
    ReverseTransaction,
}
