import 'package:flutter/material.dart';
import 'package:inout/src/application/financial/dtos/ledger_models.dart';
import 'package:inout/src/core/types/ledger_transaction_kind.dart';
import 'package:inout/src/core/utils/money_utils.dart';

final class FinancialDashboardPanel extends StatelessWidget {
  const FinancialDashboardPanel({
    required this.dashboard,
    this.onCreateAccount,
    this.onEditAccount,
    this.onSelectMetric,
    this.onSelectAccount,
    this.onSelectCategory,
    this.onSelectPeriodRange,
    this.onSelectMonth,
    super.key,
  });

  final FinancialDashboard dashboard;
  final VoidCallback? onCreateAccount;
  final void Function(String accountId)? onEditAccount;
  final void Function(LedgerTransactionKind kind)? onSelectMetric;
  final void Function(String accountId)? onSelectAccount;
  final void Function(String categoryId)? onSelectCategory;
  final void Function(DateTime from, DateTime to)? onSelectPeriodRange;
  final void Function(int year, int month)? onSelectMonth;

  @override
  Widget build(BuildContext context) => ListView(
    children: [
      Row(
        children: [
          Text('Resumo do período', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(width: 12),
          Chip(
            label: Text(
              '${dashboard.periodStart.day}/${dashboard.periodStart.month}/${dashboard.periodStart.year} - '
              '${dashboard.periodEnd.day}/${dashboard.periodEnd.month}/${dashboard.periodEnd.year}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
          const Spacer(),
          if (onSelectPeriodRange != null) ...[
            OutlinedButton.icon(
              icon: const Icon(Icons.date_range, size: 18),
              label: const Text('Filtrar período'),
              onPressed: () async {
                final picked = await showDateRangePicker(
                  context: context,
                  firstDate: DateTime(2000),
                  lastDate: DateTime(2100),
                  initialDateRange: DateTimeRange(
                    start: DateTime(
                      dashboard.periodStart.year,
                      dashboard.periodStart.month,
                      dashboard.periodStart.day,
                    ),
                    end: DateTime(
                      dashboard.periodEnd.year,
                      dashboard.periodEnd.month,
                      dashboard.periodEnd.day,
                    ),
                  ),
                );
                if (picked != null) {
                  onSelectPeriodRange!(picked.start, picked.end);
                }
              },
            ),
            const SizedBox(width: 8),
          ],
          Icon(
            dashboard.isReconciled
                ? Icons.verified_outlined
                : Icons.warning_amber,
            color: dashboard.isReconciled ? Colors.green : Colors.orange,
          ),
        ],
      ),
      const SizedBox(height: 16),
      ...dashboard.summaries.map(
        (summary) => Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            _Metric(
              label: 'Saldo consolidado (${summary.currency})',
              value: summary.consolidatedBalanceCents,
              currency: summary.currency,
            ),
            _Metric(
              label: 'Receitas',
              value: summary.incomeCents,
              currency: summary.currency,
              onTap: onSelectMetric != null
                  ? () => onSelectMetric!(LedgerTransactionKind.income)
                  : null,
            ),
            _Metric(
              label: 'Despesas',
              value: summary.expenseCents,
              currency: summary.currency,
              onTap: onSelectMetric != null
                  ? () => onSelectMetric!(LedgerTransactionKind.expense)
                  : null,
            ),
            _Metric(
              label: 'Resultado',
              value: summary.resultCents,
              currency: summary.currency,
            ),
          ],
        ),
      ),
      const SizedBox(height: 24),
      _Section(
        title: 'Contas',
        children: dashboard.accounts.isEmpty
            ? [
                const Text('Nenhuma conta cadastrada.'),
                if (onCreateAccount != null) ...[
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: onCreateAccount,
                    icon: const Icon(Icons.add),
                    label: const Text('Criar conta'),
                  ),
                ],
              ]
            : dashboard.accounts
                .map(
                  (item) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    onTap: onSelectAccount != null
                        ? () => onSelectAccount!(item.accountId)
                        : null,
                    title: Text(item.accountName),
                    subtitle: Text(item.currency),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          MoneyUtils.format(item.balanceCents, item.currency),
                        ),
                        if (onEditAccount != null) ...[
                          const SizedBox(width: 4),
                          IconButton(
                            icon: const Icon(Icons.edit_outlined, size: 20),
                            onPressed: () => onEditAccount!(item.accountId),
                            tooltip: 'Editar conta',
                          ),
                        ],
                      ],
                    ),
                  ),
                )
                .toList(),
      ),
      _Section(
        title: 'Despesas por categoria',
        children: dashboard.categoryExpenses.isEmpty
            ? const [Text('Nenhuma despesa neste período.')]
            : dashboard.categoryExpenses
                  .map(
                    (item) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      onTap: onSelectCategory != null
                          ? () => onSelectCategory!(item.categoryId)
                          : null,
                      title: Text(item.categoryName),
                      trailing: Text(
                        MoneyUtils.format(item.amountCents, item.currency),
                      ),
                    ),
                  )
                  .toList(),
      ),
      _Section(
        title: 'Orçamentos',
        children: dashboard.budgets.isEmpty
            ? const [Text('Nenhum orçamento configurado para o período.')]
            : dashboard.budgets
                  .map(
                    (item) => _Progress(
                      label: item.categoryName,
                      value: item.spentCents,
                      target: item.limitCents,
                    ),
                  )
                  .toList(),
      ),
      _Section(
        title: 'Metas',
        children: dashboard.goals.isEmpty
            ? const [Text('Nenhuma meta ativa.')]
            : dashboard.goals
                  .map(
                    (item) => _Progress(
                      label: item.name,
                      value: item.allocatedCents,
                      target: item.targetCents,
                    ),
                  )
                  .toList(),
      ),
    ],
  );
}

final class _Metric extends StatelessWidget {
  const _Metric({
    required this.label,
    required this.value,
    required this.currency,
    this.onTap,
  });
  final String label;
  final int value;
  final String currency;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: 220,
    child: Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label),
              const SizedBox(height: 8),
              Text(
                MoneyUtils.format(value, currency),
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

final class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});
  final String title;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 24),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        ...children,
      ],
    ),
  );
}

final class _Progress extends StatelessWidget {
  const _Progress({
    required this.label,
    required this.value,
    required this.target,
  });
  final String label;
  final int value;
  final int target;
  @override
  Widget build(BuildContext context) {
    final progress = target <= 0 ? 0.0 : (value / target).clamp(0.0, 1.0);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$label · ${MoneyUtils.formatBrl(value)} de ${MoneyUtils.formatBrl(target)}',
          ),
          const SizedBox(height: 6),
          LinearProgressIndicator(value: progress),
        ],
      ),
    );
  }
}
