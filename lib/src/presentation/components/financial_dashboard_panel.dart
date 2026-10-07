import 'package:flutter/material.dart';
import 'package:inout/src/application/financial/dtos/ledger_models.dart';
import 'package:inout/src/core/types/ledger_transaction_kind.dart';
import 'package:inout/src/core/utils/money_utils.dart';

final class FinancialDashboardPanel extends StatelessWidget {
  const FinancialDashboardPanel({
    required this.dashboard,
    this.comparison,
    this.onCreateAccount,
    this.onDefineBudget,
    this.onEditAccount,
    this.onSelectMetric,
    this.onSelectAccount,
    this.onSelectCategory,
    this.onSelectPeriodRange,
    this.onSelectMonth,
    super.key,
  });

  final FinancialDashboard dashboard;
  final FinancialPeriodComparison? comparison;
  final VoidCallback? onCreateAccount;
  final VoidCallback? onDefineBudget;
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
      ...dashboard.summaries.map((summary) {
        final currencyComp = comparison?.currencies.firstWhere(
          (c) => c.currency == summary.currency,
          orElse: () => CurrencyComparisonResult(
            currency: summary.currency,
            currentFacts: PeriodFactSummary(
              incomeCents: summary.incomeCents,
              expenseCents: summary.expenseCents,
              resultCents: summary.resultCents,
              consolidatedBalanceCents: summary.consolidatedBalanceCents,
            ),
            previousFacts: const PeriodFactSummary(
              incomeCents: 0,
              expenseCents: 0,
              resultCents: 0,
              consolidatedBalanceCents: 0,
            ),
            deltas: const PeriodInterpretationDelta(
              incomeDeltaCents: 0,
              expenseDeltaCents: 0,
              resultDeltaCents: 0,
            ),
          ),
        );

        return Wrap(
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
              pctChange: comparison != null ? currencyComp?.deltas.incomePercentageChange : null,
              onTap: onSelectMetric != null
                  ? () => onSelectMetric!(LedgerTransactionKind.income)
                  : null,
            ),
            _Metric(
              label: 'Despesas',
              value: summary.expenseCents,
              currency: summary.currency,
              pctChange: comparison != null ? currencyComp?.deltas.expensePercentageChange : null,
              onTap: onSelectMetric != null
                  ? () => onSelectMetric!(LedgerTransactionKind.expense)
                  : null,
            ),
            _Metric(
              label: 'Resultado',
              value: summary.resultCents,
              currency: summary.currency,
              pctChange: comparison != null ? currencyComp?.deltas.resultPercentageChange : null,
            ),
          ],
        );
      }),
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
                  (item) {
                    final netSign = item.netChangeCents >= 0 ? '+' : '';
                    final activityText = item.inflowCents > 0 || item.outflowCents > 0
                        ? '${item.currency} · Entradas: ${MoneyUtils.format(item.inflowCents, item.currency)} · Saídas: ${MoneyUtils.format(item.outflowCents, item.currency)} (Variação: $netSign${MoneyUtils.format(item.netChangeCents, item.currency)})'
                        : item.currency;

                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      onTap: onSelectAccount != null
                          ? () => onSelectAccount!(item.accountId)
                          : null,
                      title: Text(item.accountName),
                      subtitle: Text(activityText, style: const TextStyle(fontSize: 12)),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            MoneyUtils.format(item.balanceCents, item.currency),
                            style: const TextStyle(fontWeight: FontWeight.bold),
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
                    );
                  },
                )
                .toList(),
      ),
      _Section(
        title: 'Receitas por fonte',
        children: dashboard.incomeSources.isEmpty
            ? const [Text('Nenhuma receita por fonte neste período.')]
            : dashboard.incomeSources
                  .map(
                    (item) {
                      final summary = dashboard.summaries.firstWhere(
                        (s) => s.currency == item.currency,
                        orElse: () => DashboardCurrencySummary(
                          currency: item.currency,
                          consolidatedBalanceCents: 0,
                          incomeCents: 0,
                          expenseCents: 0,
                          resultCents: 0,
                        ),
                      );
                      final totalInc = summary.incomeCents;
                      final pct = totalInc > 0
                          ? ((item.amountCents / totalInc) * 100).toStringAsFixed(1)
                          : null;

                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(item.sourceName),
                        subtitle: pct != null ? Text('$pct% do total de receitas') : null,
                        trailing: Text(
                          MoneyUtils.format(item.amountCents, item.currency),
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      );
                    },
                  )
                  .toList(),
      ),
      _Section(
        title: 'Despesas por categoria',
        children: dashboard.categoryExpenses.isEmpty
            ? const [Text('Nenhuma despesa neste período.')]
            : dashboard.categoryExpenses
                  .map(
                    (item) {
                      final summary = dashboard.summaries.firstWhere(
                        (s) => s.currency == item.currency,
                        orElse: () => DashboardCurrencySummary(
                          currency: item.currency,
                          consolidatedBalanceCents: 0,
                          incomeCents: 0,
                          expenseCents: 0,
                          resultCents: 0,
                        ),
                      );
                      final totalExp = summary.expenseCents;
                      final pct = totalExp > 0
                          ? ((item.amountCents / totalExp) * 100).toStringAsFixed(1)
                          : null;

                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        onTap: onSelectCategory != null
                            ? () => onSelectCategory!(item.categoryId)
                            : null,
                        title: Text(item.categoryName),
                        subtitle: pct != null ? Text('$pct% das despesas totais') : null,
                        trailing: Text(
                          MoneyUtils.format(item.amountCents, item.currency),
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      );
                    },
                  )
                  .toList(),
      ),
      _Section(
        title: 'Orçamentos',
        action: onDefineBudget != null
            ? TextButton.icon(
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Definir orçamento'),
                onPressed: onDefineBudget,
              )
            : null,
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
    this.pctChange,
    this.onTap,
  });
  final String label;
  final int value;
  final String currency;
  final double? pctChange;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final hasPct = pctChange != null;
    final isPositive = (pctChange ?? 0) >= 0;
    final pctText = hasPct
        ? '${isPositive ? "+" : ""}${pctChange!.toStringAsFixed(1)}% vs. período anterior'
        : null;

    return SizedBox(
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
                if (pctText != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    pctText,
                    style: TextStyle(
                      fontSize: 11,
                      color: isPositive ? Colors.green : Colors.red,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

final class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children, this.action});
  final String title;
  final Widget? action;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 24),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            if (action != null) action!,
          ],
        ),
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
