import 'package:inout/src/domain/transaction/financial_flow.dart';

final class LedgerWriteResult {
  const LedgerWriteResult({
    required this.transactionId,
    required this.replayed,
  });

  final String transactionId;
  final bool replayed;
}

final class AccountBalance {
  const AccountBalance({
    required this.accountId,
    required this.currency,
    required this.balanceCents,
  });

  final String accountId;
  final String currency;
  final int balanceCents;
}

final class AccountSummary {
  const AccountSummary({
    required this.id,
    required this.name,
    required this.kind,
    required this.currency,
    required this.balanceCents,
    required this.archivedAt,
  });

  final String id;
  final String name;
  final String kind;
  final String currency;
  final int balanceCents;
  final DateTime? archivedAt;
}

final class AccountCreationResult {
  const AccountCreationResult({required this.account, required this.replayed});

  final AccountSummary account;
  final bool replayed;
}

final class CategorySummary {
  const CategorySummary({
    required this.id,
    required this.name,
    required this.flow,
    required this.parentId,
    required this.archivedAt,
  });

  final String id;
  final String name;
  final FinancialFlow flow;
  final String? parentId;
  final DateTime? archivedAt;
}

final class IncomeSourceSummary {
  const IncomeSourceSummary({
    required this.id,
    required this.name,
    this.archivedAt,
  });
  final String id;
  final String name;
  final DateTime? archivedAt;
}

final class LedgerHistoryItem {
  const LedgerHistoryItem({
    required this.transactionId,
    required this.kind,
    required this.status,
    required this.description,
    required this.reversalOf,
    required this.occurredOn,
    required this.postedAt,
    required this.createdBy,
    required this.accountId,
    required this.accountName,
    required this.categoryId,
    required this.categoryName,
    this.incomeSourceId,
    this.incomeSourceName,
    required this.direction,
    required this.amountCents,
    required this.currency,
  });

  final String transactionId;
  final String kind;
  final String status;
  final String? description;
  final String? reversalOf;
  final DateTime occurredOn;
  final DateTime postedAt;
  final String createdBy;
  final String accountId;
  final String accountName;
  final String? categoryId;
  final String? categoryName;
  final String? incomeSourceId;
  final String? incomeSourceName;
  final String direction;
  final int amountCents;
  final String currency;
}

final class LedgerReconciliation {
  const LedgerReconciliation({
    required this.isConsistent,
    required this.postedTransactionCount,
    required this.entryTransactionCount,
    required this.balances,
  });

  final bool isConsistent;
  final int postedTransactionCount;
  final int entryTransactionCount;
  final List<AccountBalance> balances;
}

final class DashboardCurrencySummary {
  const DashboardCurrencySummary({
    required this.currency,
    required this.consolidatedBalanceCents,
    required this.incomeCents,
    required this.expenseCents,
    required this.resultCents,
  });
  final String currency;
  final int consolidatedBalanceCents;
  final int incomeCents;
  final int expenseCents;
  final int resultCents;
}

final class DashboardAccountBalance {
  const DashboardAccountBalance({
    required this.accountId,
    required this.accountName,
    required this.currency,
    required this.balanceCents,
  });
  final String accountId;
  final String accountName;
  final String currency;
  final int balanceCents;
}

final class DashboardCategoryExpense {
  const DashboardCategoryExpense({
    required this.categoryId,
    required this.categoryName,
    required this.parentId,
    required this.currency,
    required this.amountCents,
  });
  final String categoryId;
  final String categoryName;
  final String? parentId;
  final String currency;
  final int amountCents;
}

final class DashboardBudgetProgress {
  const DashboardBudgetProgress({
    required this.budgetId,
    required this.categoryId,
    required this.categoryName,
    required this.limitCents,
    required this.spentCents,
  });
  final String budgetId;
  final String categoryId;
  final String categoryName;
  final int limitCents;
  final int spentCents;
}

final class DashboardGoalProgress {
  const DashboardGoalProgress({
    required this.goalId,
    required this.name,
    required this.targetCents,
    required this.allocatedCents,
    required this.targetDate,
  });
  final String goalId;
  final String name;
  final int targetCents;
  final int allocatedCents;
  final DateTime? targetDate;
}

final class FinancialDashboard {
  const FinancialDashboard({
    required this.periodStart,
    required this.periodEnd,
    required this.isReconciled,
    required this.summaries,
    required this.accounts,
    required this.categoryExpenses,
    required this.budgets,
    required this.goals,
  });
  final DateTime periodStart;
  final DateTime periodEnd;
  final bool isReconciled;
  final List<DashboardCurrencySummary> summaries;
  final List<DashboardAccountBalance> accounts;
  final List<DashboardCategoryExpense> categoryExpenses;
  final List<DashboardBudgetProgress> budgets;
  final List<DashboardGoalProgress> goals;
}
