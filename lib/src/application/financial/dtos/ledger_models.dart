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
  });

  final String id;
  final String name;
  final String flow;
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
