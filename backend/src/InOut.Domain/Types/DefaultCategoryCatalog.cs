namespace InOut.Domain.Financial;

public sealed record DefaultCategoryDefinition(
    DefaultCategoryKind Kind,
    string Name,
    FinancialFlow Flow);

public static class DefaultCategoryCatalog
{
    public static IReadOnlyList<DefaultCategoryDefinition> All { get; } =
    [
        new(DefaultCategoryKind.Salary, "Salário", FinancialFlow.Income),
        new(DefaultCategoryKind.OtherIncome, "Outras receitas", FinancialFlow.Income),
        new(DefaultCategoryKind.Housing, "Moradia", FinancialFlow.Expense),
        new(DefaultCategoryKind.Food, "Alimentação", FinancialFlow.Expense),
        new(DefaultCategoryKind.Transport, "Transporte", FinancialFlow.Expense),
        new(DefaultCategoryKind.OtherExpense, "Outras despesas", FinancialFlow.Expense),
    ];
}
