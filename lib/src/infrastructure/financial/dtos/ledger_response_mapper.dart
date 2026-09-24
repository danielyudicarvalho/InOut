import 'package:inout/src/application/financial/ledger_repository.dart';
import 'package:inout/src/domain/transaction/financial_flow.dart';
import 'package:inout/src/infrastructure/http/api_contract.dart';

abstract final class LedgerResponseMapper {
  static AccountBalance balance(Map<String, dynamic> row) => AccountBalance(
    accountId: row[ApiFields.accountId]! as String,
    currency: row[ApiFields.currency]! as String,
    balanceCents: row[ApiFields.balanceCents]! as int,
  );

  static AccountSummary account(Map<String, dynamic> row) => AccountSummary(
    id: row[ApiFields.id]! as String,
    name: row[ApiFields.name]! as String,
    kind: row[ApiFields.kind]! as String,
    currency: row[ApiFields.currency]! as String,
    balanceCents: row[ApiFields.balanceCents]! as int,
    archivedAt: row[ApiFields.archivedAt] == null
        ? null
        : DateTime.parse(row[ApiFields.archivedAt]! as String),
  );

  static LedgerHistoryItem historyItem(Map<String, dynamic> row) =>
      LedgerHistoryItem(
        transactionId: row[ApiFields.transactionId]! as String,
        kind: row[ApiFields.kind]! as String,
        status: row[ApiFields.status]! as String,
        description: row[ApiFields.description] as String?,
        reversalOf: row[ApiFields.reversalOf] as String?,
        occurredOn: DateTime.parse(row[ApiFields.occurredOn]! as String),
        postedAt: DateTime.parse(row[ApiFields.postedAt]! as String),
        createdBy: row[ApiFields.createdBy]! as String,
        accountId: row[ApiFields.accountId]! as String,
        accountName: row[ApiFields.accountName]! as String,
        categoryId: row[ApiFields.categoryId] as String?,
        categoryName: row[ApiFields.categoryName] as String?,
        incomeSourceId: row[ApiFields.incomeSourceId] as String?,
        incomeSourceName: row[ApiFields.incomeSourceName] as String?,
        direction: row[ApiFields.direction]! as String,
        amountCents: row[ApiFields.amountCents]! as int,
        currency: row[ApiFields.currency]! as String,
      );

  static IncomeSourceSummary incomeSource(Map<String, dynamic> row) =>
      IncomeSourceSummary(
        id: row[ApiFields.id]! as String,
        name: row[ApiFields.name]! as String,
        archivedAt: row[ApiFields.archivedAt] == null
            ? null
            : DateTime.parse(row[ApiFields.archivedAt]! as String),
      );

  static CategorySummary category(Map<String, dynamic> row) => CategorySummary(
    id: row[ApiFields.id]! as String,
    name: row[ApiFields.name]! as String,
    flow: FinancialFlow.parse(row[ApiFields.flow]! as String),
    parentId: row[ApiFields.parentId] as String?,
    archivedAt: row[ApiFields.archivedAt] == null
        ? null
        : DateTime.parse(row[ApiFields.archivedAt]! as String),
  );

  static FinancialDashboard dashboard(Map<String, dynamic> row) =>
      FinancialDashboard(
        periodStart: DateTime.parse(row[ApiFields.periodStart]! as String),
        periodEnd: DateTime.parse(row[ApiFields.periodEnd]! as String),
        isReconciled: row[ApiFields.isReconciled]! as bool,
        summaries: _rows(row, ApiFields.summaries)
            .map(
              (item) => DashboardCurrencySummary(
                currency: item[ApiFields.currency]! as String,
                consolidatedBalanceCents:
                    item[ApiFields.consolidatedBalanceCents]! as int,
                incomeCents: item[ApiFields.incomeCents]! as int,
                expenseCents: item[ApiFields.expenseCents]! as int,
                resultCents: item[ApiFields.resultCents]! as int,
              ),
            )
            .toList(growable: false),
        accounts: _rows(row, ApiFields.accounts)
            .map(
              (item) => DashboardAccountBalance(
                accountId: item[ApiFields.accountId]! as String,
                accountName: item[ApiFields.accountName]! as String,
                currency: item[ApiFields.currency]! as String,
                balanceCents: item[ApiFields.balanceCents]! as int,
              ),
            )
            .toList(growable: false),
        categoryExpenses: _rows(row, ApiFields.categoryExpenses)
            .map(
              (item) => DashboardCategoryExpense(
                categoryId: item[ApiFields.categoryId]! as String,
                categoryName: item[ApiFields.categoryName]! as String,
                parentId: item[ApiFields.parentId] as String?,
                currency: item[ApiFields.currency]! as String,
                amountCents: item[ApiFields.amountCents]! as int,
              ),
            )
            .toList(growable: false),
        budgets: _rows(row, ApiFields.budgets)
            .map(
              (item) => DashboardBudgetProgress(
                budgetId: item[ApiFields.budgetId]! as String,
                categoryId: item[ApiFields.categoryId]! as String,
                categoryName: item[ApiFields.categoryName]! as String,
                limitCents: item[ApiFields.limitCents]! as int,
                spentCents: item[ApiFields.spentCents]! as int,
              ),
            )
            .toList(growable: false),
        goals: _rows(row, ApiFields.goals)
            .map(
              (item) => DashboardGoalProgress(
                goalId: item[ApiFields.goalId]! as String,
                name: item[ApiFields.name]! as String,
                targetCents: item[ApiFields.targetCents]! as int,
                allocatedCents: item[ApiFields.allocatedCents]! as int,
                targetDate: item[ApiFields.targetDate] == null
                    ? null
                    : DateTime.parse(item[ApiFields.targetDate]! as String),
              ),
            )
            .toList(growable: false),
      );

  static Iterable<Map<String, dynamic>> _rows(
    Map<String, dynamic> row,
    String field,
  ) => (row[field]! as List<dynamic>).cast<Map<String, dynamic>>();
}
