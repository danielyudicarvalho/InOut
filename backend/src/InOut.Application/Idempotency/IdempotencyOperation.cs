namespace InOut.Application.Idempotency;

public enum IdempotencyOperation
{
    CreateAccount,
    PostIncome,
    PostExpense,
    PostTransfer,
    ReverseTransaction,
}
