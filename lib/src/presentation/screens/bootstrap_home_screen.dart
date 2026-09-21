import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:inout/src/application/sync/household_sync_gateway.dart';
import 'package:inout/src/core/utils/money_utils.dart';
import 'package:inout/src/domain/household/household.dart';
import 'package:inout/src/domain/transaction/financial_flow.dart';
import 'package:inout/src/presentation/components/financial_flow_card.dart';
import 'package:inout/src/presentation/components/sync_status_banner.dart';
import 'package:inout/src/presentation/layout/inout_adaptive_scaffold.dart';
import 'package:inout/src/presentation/providers/household_providers.dart';
import 'package:inout/src/presentation/providers/session_providers.dart';
import 'package:inout/src/presentation/screens/transaction_form_screen.dart';

final class BootstrapHomeScreen extends ConsumerWidget {
  const BootstrapHomeScreen({this.household, super.key});

  final Household? household;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (household case final selected?) {
      final accounts = ref.watch(ledgerAccountsProvider(selected.id));
      final sync = ref.watch(householdSyncProvider(selected.id));
      return InOutAdaptiveScaffold(
        title: 'InOut',
        selectedIndex: 0,
        onDestinationSelected: (_) {},
        destinations: _destinations,
        body: Column(
          children: [
            SyncStatusBanner(
              offline:
                  sync.asData?.value == HouseholdSyncEvent.disconnected ||
                  sync.hasError,
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: accounts.when(
                  data: (items) => Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        selected.name,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Saldo total: ${MoneyUtils.formatBrl(items.fold(0, (sum, item) => sum + item.balanceCents))}',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: 24),
                      Wrap(
                        spacing: 12,
                        runSpacing: 12,
                        children: [
                          FinancialFlowCard(
                            flow: FinancialFlow.income,
                            onTap: () => _openForm(
                              context,
                              ref,
                              selected,
                              FinancialFlow.income,
                            ),
                          ),
                          FinancialFlowCard(
                            flow: FinancialFlow.expense,
                            onTap: () => _openForm(
                              context,
                              ref,
                              selected,
                              FinancialFlow.expense,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      Text(
                        'Contas',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      if (items.isEmpty)
                        const Padding(
                          padding: EdgeInsets.only(top: 12),
                          child: Text(
                            'Crie uma conta antes do primeiro lançamento.',
                          ),
                        )
                      else
                        ...items.map(
                          (item) => ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(item.name),
                            trailing: Text(
                              MoneyUtils.formatBrl(item.balanceCents),
                            ),
                          ),
                        ),
                    ],
                  ),
                  error: (error, stackTrace) =>
                      const Text('Não foi possível carregar o ledger.'),
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                ),
              ),
            ),
          ],
        ),
      );
    }
    final summary = ref.watch(householdSummaryProvider);

    return InOutAdaptiveScaffold(
      title: 'InOut',
      selectedIndex: 0,
      onDestinationSelected: (_) {},
      destinations: _destinations,
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: summary.when(
          data: (value) => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(value.name, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(
                'Saldo inicial: ${MoneyUtils.formatBrl(value.balanceInCents)}',
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
          error: (error, stackTrace) =>
              const Text('Não foi possível carregar os dados da casa.'),
          loading: () => const CircularProgressIndicator(),
        ),
      ),
    );
  }

  static const _destinations = [
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
  ];

  static Future<void> _openForm(
    BuildContext context,
    WidgetRef ref,
    Household household,
    FinancialFlow flow,
  ) async {
    await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => TransactionFormScreen(household: household, flow: flow),
      ),
    );
    ref.invalidate(ledgerAccountsProvider(household.id));
  }
}
