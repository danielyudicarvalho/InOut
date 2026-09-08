import 'package:flutter/material.dart';
import 'package:inout/src/presentation/theme/inout_theme.dart';

enum FinancialFlow { income, expense }

final class FinancialFlowCard extends StatelessWidget {
  const FinancialFlowCard({required this.flow, super.key});
  final FinancialFlow flow;

  @override
  Widget build(BuildContext context) {
    final palette = context.inOutPalette;
    final isIncome = flow == FinancialFlow.income;
    final label = isIncome ? 'In · Entradas' : 'Out · Saídas';
    final description = isIncome ? 'Recursos recebidos' : 'Recursos gastos';
    final icon = isIncome ? Icons.arrow_downward : Icons.arrow_upward;
    final color = isIncome ? palette.inPrimary : palette.outPrimary;
    final container = isIncome ? palette.inContainer : palette.outContainer;

    return Semantics(
      label: '$label. $description.', button: true,
      child: Card(
        color: container,
        child: InkWell(
          onTap: () {}, borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(icon, color: color),
              const SizedBox(width: 12),
              Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: palette.textPrimary,
                      ),
                ),
                Text(description, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: palette.textSecondary)),
              ]),
            ]),
          ),
        ),
      ),
    );
  }
}
