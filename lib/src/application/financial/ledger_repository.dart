import 'package:inout/src/application/financial/dtos/ledger_models.dart';

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

  Future<List<CategorySummary>> getCategories(
    String householdId, {
    String? flow,
  });

  Future<List<LedgerHistoryItem>> getHistory(
    String householdId, {
    int limit = 100,
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

  Future<List<AccountBalance>> getBalances(String householdId);

  Future<LedgerReconciliation> reconcile(String householdId);
}
