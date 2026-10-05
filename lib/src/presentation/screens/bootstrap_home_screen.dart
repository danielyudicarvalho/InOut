import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:inout/src/application/sync/household_sync_gateway.dart';
import 'package:inout/src/core/types/ledger_transaction_kind.dart';
import 'package:inout/src/core/utils/money_utils.dart';
import 'package:inout/src/domain/household/household.dart';
import 'package:inout/src/domain/transaction/financial_flow.dart';
import 'package:inout/src/presentation/components/financial_dashboard_panel.dart';
import 'package:inout/src/presentation/components/financial_flow_card.dart';
import 'package:inout/src/presentation/components/sync_status_banner.dart';
import 'package:inout/src/presentation/layout/inout_adaptive_scaffold.dart';
import 'package:inout/src/presentation/providers/household_providers.dart';
import 'package:inout/src/presentation/providers/session_providers.dart';
import 'package:inout/src/presentation/screens/account_form_screen.dart';
import 'package:inout/src/presentation/screens/category_management_screen.dart';
import 'package:inout/src/presentation/screens/ledger_history_screen.dart';
import 'package:inout/src/presentation/screens/transaction_form_screen.dart';
import 'package:inout/src/presentation/screens/transfer_form_screen.dart';

final class BootstrapHomeScreen extends ConsumerStatefulWidget {
  const BootstrapHomeScreen({this.household, super.key});

  final Household? household;

  @override
  ConsumerState<BootstrapHomeScreen> createState() =>
      _BootstrapHomeScreenState();
}

final class _BootstrapHomeScreenState
    extends ConsumerState<BootstrapHomeScreen> {
  int _selectedIndex = 0;
  String? _historyAccountId;
  String? _historyCategoryId;
  LedgerTransactionKind? _historyKind;

  DateTime? _dashboardFrom;
  DateTime? _dashboardTo;
  int? _dashboardYear;
  int? _dashboardMonth;

  @override
  Widget build(BuildContext context) {
    final household = widget.household;
    if (household case final selected?) {
      final now = DateTime.now();
      final dashboardInput = (
        householdId: selected.id,
        year: _dashboardFrom == null ? (_dashboardYear ?? now.year) : null,
        month: _dashboardFrom == null ? (_dashboardMonth ?? now.month) : null,
        from: _dashboardFrom,
        to: _dashboardTo,
      );
      final dashboard = ref.watch(financialDashboardProvider(dashboardInput));
      final comparison = ref.watch(financialPeriodComparisonProvider(dashboardInput));
      final sync = ref.watch(householdSyncProvider(selected.id));

      Widget body;
      switch (_selectedIndex) {
        case 1:
          body = LedgerHistoryScreen(
            household: selected,
            initialAccountId: _historyAccountId,
            initialCategoryId: _historyCategoryId,
            initialKind: _historyKind,
          );
          break;
        case 2:
          body = CategoryManagementScreen(household: selected);
          break;
        case 0:
        default:
          body = Column(
            children: [
              SyncStatusBanner(
                offline:
                    sync.asData?.value == HouseholdSyncEvent.disconnected ||
                    sync.hasError,
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: dashboard.when(
                    data: (value) => Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          selected.name,
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 8),
                        const SizedBox(height: 12),
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
                        Wrap(
                          spacing: 12,
                          runSpacing: 12,
                          children: [
                            OutlinedButton.icon(
                              icon: const Icon(Icons.add_card),
                              label: const Text('Nova conta'),
                              onPressed: () =>
                                  _openAccountForm(context, ref, selected),
                            ),
                            OutlinedButton.icon(
                              icon: const Icon(Icons.category_outlined),
                              label: const Text('Categorias'),
                              onPressed: () =>
                                  setState(() => _selectedIndex = 2),
                            ),
                            OutlinedButton.icon(
                              icon: const Icon(Icons.history),
                              label: const Text('Histórico e filtros'),
                              onPressed: () => setState(() {
                                _historyAccountId = null;
                                _historyCategoryId = null;
                                _historyKind = null;
                                _selectedIndex = 1;
                              }),
                            ),
                            OutlinedButton.icon(
                              icon: const Icon(Icons.swap_horiz),
                              label: const Text('Transferir'),
                              onPressed: () async {
                                final changed = await Navigator.of(context)
                                    .push<bool>(
                                      MaterialPageRoute(
                                        builder: (_) => TransferFormScreen(
                                          household: selected,
                                        ),
                                      ),
                                    );
                                if (changed == true) {
                                  ref.invalidate(
                                    ledgerAccountsProvider(selected.id),
                                  );
                                  ref.invalidate(financialDashboardProvider);
                                }
                              },
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Expanded(
                          child: FinancialDashboardPanel(
                            dashboard: value,
                            comparison: comparison.asData?.value,
                            onCreateAccount: () =>
                                _openAccountForm(context, ref, selected),
                            onEditAccount: (accountId) => _openAccountEditForm(
                              context,
                              ref,
                              selected,
                              accountId,
                            ),
                            onSelectMetric: (kind) => setState(() {
                              _historyKind = kind;
                              _historyAccountId = null;
                              _historyCategoryId = null;
                              _selectedIndex = 1;
                            }),
                            onSelectAccount: (accountId) => setState(() {
                              _historyAccountId = accountId;
                              _historyCategoryId = null;
                              _historyKind = null;
                              _selectedIndex = 1;
                            }),
                            onSelectCategory: (categoryId) => setState(() {
                              _historyCategoryId = categoryId;
                              _historyAccountId = null;
                              _historyKind = null;
                              _selectedIndex = 1;
                            }),
                            onSelectPeriodRange: (from, to) => setState(() {
                              _dashboardFrom = from;
                              _dashboardTo = to;
                              _dashboardYear = null;
                              _dashboardMonth = null;
                            }),
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
          );
          break;
      }

      return InOutAdaptiveScaffold(
        title: 'InOut',
        selectedIndex: _selectedIndex,
        onDestinationSelected: (index) {
          setState(() {
            _selectedIndex = index;
          });
        },
        destinations: _destinations,
        body: body,
      );
    }
    final summary = ref.watch(householdSummaryProvider);

    return InOutAdaptiveScaffold(
      title: 'InOut',
      selectedIndex: _selectedIndex,
      onDestinationSelected: (index) {
        setState(() {
          _selectedIndex = index;
        });
      },
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
    ref.invalidate(financialDashboardProvider);
  }

  static Future<void> _openAccountForm(
    BuildContext context,
    WidgetRef ref,
    Household household,
  ) async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => AccountFormScreen(household: household),
      ),
    );
    if (created == true) {
      ref.invalidate(ledgerAccountsProvider(household.id));
      ref.invalidate(financialDashboardProvider);
    }
  }

  static Future<void> _openAccountEditForm(
    BuildContext context,
    WidgetRef ref,
    Household household,
    String accountId,
  ) async {
    final accounts = await ref.read(
      ledgerAccountsProvider(household.id).future,
    );
    final account = accounts.firstWhere((a) => a.id == accountId);
    final updated = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) =>
            AccountFormScreen(household: household, accountToEdit: account),
      ),
    );
    if (updated == true) {
      ref.invalidate(ledgerAccountsProvider(household.id));
      ref.invalidate(financialDashboardProvider);
    }
  }
}
