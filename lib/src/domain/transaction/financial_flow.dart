/// Canonical direction of a financial movement in the InOut domain.
enum FinancialFlow {
  income,
  expense;

  static FinancialFlow parse(String value) => FinancialFlow.values.byName(value);
}
