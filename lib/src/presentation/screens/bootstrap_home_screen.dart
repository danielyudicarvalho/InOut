import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:inout/src/presentation/formatters/money_formatter.dart';
import 'package:inout/src/presentation/providers/household_providers.dart';
import 'package:inout/src/presentation/theme/inout_theme.dart';

final class BootstrapHomeScreen extends ConsumerWidget {
  const BootstrapHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(householdSummaryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('InOut')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: summary.when(
              data: (value) => Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(value.name, style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  Text(
                    'Saldo inicial: ${MoneyFormatter.formatBrl(value.balanceInCents)}',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 24),
                  const Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    alignment: WrapAlignment.center,
                    children: [
                      _FlowChip(
                        label: 'In · Entradas',
                        icon: Icons.arrow_downward,
                        color: InOutColors.inPrimary,
                      ),
                      _FlowChip(
                        label: 'Out · Saídas',
                        icon: Icons.arrow_upward,
                        color: InOutColors.outPrimary,
                      ),
                    ],
                  ),
                ],
              ),
              error: (error, stackTrace) => const Text(
                'Não foi possível carregar os dados da casa.',
              ),
              loading: () => const CircularProgressIndicator(),
            ),
          ),
        ),
      ),
    );
  }
}

final class _FlowChip extends StatelessWidget {
  const _FlowChip({
    required this.label,
    required this.icon,
    required this.color,
  });

  final String label;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: Icon(icon, color: color),
      label: Text(label),
      side: BorderSide(color: color),
    );
  }
}
