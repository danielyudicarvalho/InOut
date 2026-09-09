import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inout/src/domain/transaction/financial_flow.dart';
import 'package:inout/src/presentation/components/financial_flow_card.dart';
import 'package:inout/src/presentation/theme/inout_theme.dart';

void main() {
  testWidgets('identifies financial flows with labels and distinct icons', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: InOutTheme.light,
        home: const Scaffold(
          body: Column(
            children: [
              FinancialFlowCard(flow: FinancialFlow.income),
              FinancialFlowCard(flow: FinancialFlow.expense),
            ],
          ),
        ),
      ),
    );

    expect(find.text('In · Entradas'), findsOneWidget);
    expect(find.text('Out · Saídas'), findsOneWidget);
    expect(find.byIcon(Icons.arrow_downward), findsOneWidget);
    expect(find.byIcon(Icons.arrow_upward), findsOneWidget);
    expect(find.byType(InkWell), findsNothing);
  });

  testWidgets('only becomes interactive when an action is provided', (
    tester,
  ) async {
    var tapped = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: InOutTheme.light,
        home: Scaffold(
          body: FinancialFlowCard(
            flow: FinancialFlow.income,
            onTap: () => tapped = true,
          ),
        ),
      ),
    );

    expect(find.byType(InkWell), findsOneWidget);
    await tester.tap(find.byType(FinancialFlowCard));
    expect(tapped, isTrue);
  });
}
