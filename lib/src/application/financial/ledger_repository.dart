import 'package:inout/src/application/financial/dtos/ledger_models.dart';
import 'package:inout/src/domain/transaction/financial_flow.dart';

export 'package:inout/src/application/financial/dtos/ledger_models.dart';

abstract interface class LedgerRepository {
  Future<AccountCreationResult> createAccount({
    required String householdId,
    required String id,
    required String name,
    required String kind,
    required String currency,
    required int initialBalanceCents,
    required DateTime openingDate,
    required String idempotencyKey,
  });

  Future<List<AccountSummary>> getAccounts(
    String householdId, {
    bool includeArchived = false,
  });

  Future<void> archiveAccount({
    required String householdId,
    required String accountId,
  });

  Future<AccountSummary> updateAccountMetadata({
    required String householdId,
    required String accountId,
    required String name,
    required String kind,
  });

  Future<List<CategorySummary>> getCategories(
    String householdId, {
    FinancialFlow? flow,
    bool includeArchived = false,
  });

  Future<CategorySummary> createCategory({
    required String householdId,
    required String id,
    required String name,
    required FinancialFlow flow,
    required String idempotencyKey,
    String? parentId,
  });

  Future<void> archiveCategory({
    required String householdId,
    required String categoryId,
  });

  Future<List<LedgerHistoryItem>> getHistory(
    String householdId, {
    int limit = 100,
    DateTime? from,
    DateTime? to,
    String? accountId,
    String? categoryId,
    String? incomeSourceId,
    String? kind,
    String? search,
  });

  Future<List<IncomeSourceSummary>> getIncomeSources(
    String householdId, {
    bool includeArchived = false,
  });

  Future<IncomeSourceSummary> createIncomeSource({
    required String householdId,
    required String id,
    required String name,
  });

  Future<void> archiveIncomeSource({
    required String householdId,
    required String sourceId,
  });

  Future<LedgerWriteResult> postIncome({
    required String householdId,
    required String accountId,
    required String categoryId,
    required int amountCents,
    required String currency,
    required DateTime occurredOn,
    required String idempotencyKey,
    String? description,
    String? incomeSourceId,
  });

  Future<LedgerWriteResult> postExpense({
    required String householdId,
    required String accountId,
    required String categoryId,
    required int amountCents,
    required String currency,
    required DateTime occurredOn,
    required String idempotencyKey,
    String? description,
  });

  Future<LedgerWriteResult> postTransfer({
    required String householdId,
    required String sourceAccountId,
    required String destinationAccountId,
    required int amountCents,
    required String currency,
    required DateTime occurredOn,
    required String idempotencyKey,
    String? description,
  });

  Future<LedgerWriteResult> reverse({
    required String householdId,
    required String transactionId,
    required DateTime occurredOn,
    required String idempotencyKey,
    String? description,
  });

  Future<LedgerHistoryItem> correctClassification({
    required String householdId,
    required String transactionId,
    String? categoryId,
    String? incomeSourceId,
    String? description,
  });

  Future<List<AccountBalance>> getBalances(String householdId);

  Future<LedgerReconciliation> reconcile(String householdId);

  Future<void> setBudget({
    required String householdId,
    required String categoryId,
    required DateTime periodStart,
    required DateTime periodEnd,
    required int limitCents,
    required String idempotencyKey,
    String? budgetId,
  });

  Future<FinancialDashboard> getDashboard(
    String householdId, {
    int? year,
    int? month,
    DateTime? from,
    DateTime? to,
  });

  Future<FinancialPeriodComparison> comparePeriods(
    String householdId, {
    int? year,
    int? month,
    DateTime? from,
    DateTime? to,
  });
}
