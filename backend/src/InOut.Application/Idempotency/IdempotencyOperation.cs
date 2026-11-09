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
    SetBudget,
    CorrectClassification,
    AllocateGoal,
    ReverseGoalAllocation,
    RealizeRecurringOccurrence,
    CreateGoal,
    UpdateGoal,
    ChangeGoalStatus,
    CreateProject,
    UpdateProject,
    CloseProject,
    LinkProjectMovement,
    UnlinkProjectMovement,
}
