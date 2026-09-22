namespace InOut.Application.Idempotency;

public enum IdempotencyOperation
{
    CreateAccount,
    CreateCategory,
    PostIncome,
    PostExpense,
    PostTransfer,
    ReverseTransaction,
}
