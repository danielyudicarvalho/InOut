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

abstract interface class LedgerRepository {
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
