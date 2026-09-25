using InOut.Application.Idempotency;

namespace InOut.Infrastructure.Idempotency;

public sealed class IdempotencyPolicy : IIdempotencyPolicy
{
    private static readonly TimeSpan FinancialCommandLease = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan FinancialCommandRetention = TimeSpan.FromDays(90);

    public IdempotencyExecutionPolicy GetPolicy(IdempotencyOperation operation) => operation switch
    {
        IdempotencyOperation.CreateAccount => FinancialCommand(),
        IdempotencyOperation.CreateCategory => FinancialCommand(),
        IdempotencyOperation.CreateRecurringPlan => FinancialCommand(),
        IdempotencyOperation.CreateForecast => FinancialCommand(),
        IdempotencyOperation.PostIncome => FinancialCommand(),
        IdempotencyOperation.PostExpense => FinancialCommand(),
        IdempotencyOperation.PostTransfer => FinancialCommand(),
        IdempotencyOperation.ReverseTransaction => FinancialCommand(),
        _ => throw new ArgumentOutOfRangeException(nameof(operation), operation, null),
    };

    private static IdempotencyExecutionPolicy FinancialCommand() =>
        new(FinancialCommandLease, FinancialCommandRetention);
}
