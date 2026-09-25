namespace InOut.Application.Idempotency;

public enum IdempotencyOperation
{
    CreateAccount,
    CreateCategory,
    CreateRecurringPlan,
    CreateForecast,
    PostIncome,
    PostExpense,
    PostTransfer,
    ReverseTransaction,
}
