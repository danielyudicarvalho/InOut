import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:inout/src/domain/transaction/financial_flow.dart';
import 'package:inout/src/presentation/components/financial_flow_card.dart';
import 'package:inout/src/presentation/formatters/money_formatter.dart';
import 'package:inout/src/presentation/layout/inout_adaptive_scaffold.dart';
import 'package:inout/src/presentation/providers/household_providers.dart';

final class BootstrapHomeScreen extends ConsumerWidget {
  const BootstrapHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(householdSummaryProvider);

    return InOutAdaptiveScaffold(
      title: 'InOut',
      selectedIndex: 0,
      onDestinationSelected: (_) {},
      destinations: const [
        InOutDestination(
          label: 'Início',
          icon: Icons.home_outlined,
          selectedIcon: Icons.home,
        ),
        InOutDestination(
          label: 'Lançamentos',
          icon: Icons.receipt_long_outlined,
          selectedIcon: Icons.receipt_long,
        ),
        InOutDestination(
          label: 'Configurações',
          icon: Icons.settings_outlined,
          selectedIcon: Icons.settings,
        ),
      ],
      body: Padding(
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
                  FinancialFlowCard(flow: FinancialFlow.income),
                  FinancialFlowCard(flow: FinancialFlow.expense),
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
    );
  }
}
