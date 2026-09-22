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
        direction: row[ApiFields.direction]! as String,
        amountCents: row[ApiFields.amountCents]! as int,
        currency: row[ApiFields.currency]! as String,
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
}
