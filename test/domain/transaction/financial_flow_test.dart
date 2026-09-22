import 'package:flutter_test/flutter_test.dart';
import 'package:inout/src/domain/transaction/financial_flow.dart';

void main() {
  test('defines the canonical financial movement directions', () {
    expect(FinancialFlow.values, [FinancialFlow.income, FinancialFlow.expense]);
  });

  test('parses the API representation into the domain enum', () {
    expect(FinancialFlow.parse('income'), FinancialFlow.income);
    expect(FinancialFlow.parse('expense'), FinancialFlow.expense);
  });
}
