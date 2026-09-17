import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:inout/src/application/financial/ledger_repository.dart';
import 'package:inout/src/infrastructure/household/api_household_repository.dart';

final class ApiLedgerRepository implements LedgerRepository {
  ApiLedgerRepository({
    required Uri baseUrl,
    required AccessTokenProvider accessToken,
    http.Client? client,
  }) : _baseUrl = baseUrl,
       _accessToken = accessToken,
       _client = client ?? http.Client();

  final Uri _baseUrl;
  final AccessTokenProvider _accessToken;
  final http.Client _client;

  void close() => _client.close();

  @override
  Future<AccountCreationResult> createAccount({
    required String householdId,
    required String id,
    required String name,
    required String kind,
    required String currency,
    required int initialBalanceCents,
    required DateTime openingDate,
  }) async {
    final response = await _send(
      'POST',
      '/api/v1/households/$householdId/ledger/accounts',
      body: {
        'id': id,
        'name': name,
        'kind': kind,
        'currency': currency,
        'initialBalanceCents': initialBalanceCents,
        'openingDate': _date(openingDate),
      },
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return AccountCreationResult(
      account: _account(body['account']! as Map<String, dynamic>),
      replayed: body['replayed']! as bool,
    );
  }

  @override
  Future<List<AccountSummary>> getAccounts(
    String householdId, {
    bool includeArchived = false,
  }) async {
    final suffix = includeArchived ? '?includeArchived=true' : '';
    final response = await _send(
      'GET',
      '/api/v1/households/$householdId/ledger/accounts$suffix',
    );
    return (jsonDecode(response.body) as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .map(_account)
        .toList(growable: false);
  }

  @override
  Future<void> archiveAccount({
    required String householdId,
    required String accountId,
  }) async {
    await _send(
      'DELETE',
      '/api/v1/households/$householdId/ledger/accounts/$accountId',
    );
  }

  @override
  Future<List<CategorySummary>> getCategories(
    String householdId, {
    String? flow,
  }) async {
    final suffix = flow == null ? '' : '?flow=$flow';
    final response = await _send(
      'GET',
      '/api/v1/households/$householdId/ledger/categories$suffix',
    );
    return (jsonDecode(response.body) as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .map(
          (row) => CategorySummary(
            id: row['id']! as String,
            name: row['name']! as String,
            flow: row['flow']! as String,
          ),
        )
        .toList(growable: false);
  }

  @override
  Future<List<LedgerHistoryItem>> getHistory(
    String householdId, {
    int limit = 100,
  }) async {
    final response = await _send(
      'GET',
      '/api/v1/households/$householdId/ledger/history?limit=$limit',
    );
    return (jsonDecode(response.body) as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .map(_historyItem)
        .toList(growable: false);
  }

  @override
  Future<LedgerWriteResult> postIncome({
    required String householdId,
    required String accountId,
    required String categoryId,
    required int amountCents,
    required String currency,
    required DateTime occurredOn,
    required String idempotencyKey,
    String? description,
  }) => _post('/api/v1/households/$householdId/ledger/income', {
    'accountId': accountId,
    'categoryId': categoryId,
    'amountCents': amountCents,
    'currency': currency,
    'occurredOn': _date(occurredOn),
    'idempotencyKey': idempotencyKey,
    'description': description,
  });

  @override
  Future<LedgerWriteResult> postExpense({
    required String householdId,
    required String accountId,
    required String categoryId,
    required int amountCents,
    required String currency,
    required DateTime occurredOn,
    required String idempotencyKey,
    String? description,
  }) => _post('/api/v1/households/$householdId/ledger/expenses', {
    'accountId': accountId,
    'categoryId': categoryId,
    'amountCents': amountCents,
    'currency': currency,
    'occurredOn': _date(occurredOn),
    'idempotencyKey': idempotencyKey,
    'description': description,
  });

  @override
  Future<LedgerWriteResult> postTransfer({
    required String householdId,
    required String sourceAccountId,
    required String destinationAccountId,
    required int amountCents,
    required String currency,
    required DateTime occurredOn,
    required String idempotencyKey,
    String? description,
  }) => _post('/api/v1/households/$householdId/ledger/transfers', {
    'sourceAccountId': sourceAccountId,
    'destinationAccountId': destinationAccountId,
    'amountCents': amountCents,
    'currency': currency,
    'occurredOn': _date(occurredOn),
    'idempotencyKey': idempotencyKey,
    'description': description,
  });

  @override
  Future<LedgerWriteResult> reverse({
    required String householdId,
    required String transactionId,
    required DateTime occurredOn,
    required String idempotencyKey,
    String? description,
  }) => _post(
    '/api/v1/households/$householdId/ledger/transactions/'
    '$transactionId/reversals',
    {
      'occurredOn': _date(occurredOn),
      'idempotencyKey': idempotencyKey,
      'description': description,
    },
  );

  @override
  Future<List<AccountBalance>> getBalances(String householdId) async {
    final response = await _send(
      'GET',
      '/api/v1/households/$householdId/ledger/balances',
    );
    return (jsonDecode(response.body) as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .map(_balance)
        .toList(growable: false);
  }

  @override
  Future<LedgerReconciliation> reconcile(String householdId) async {
    final response = await _send(
      'GET',
      '/api/v1/households/$householdId/ledger/reconciliation',
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return LedgerReconciliation(
      isConsistent: body['isConsistent']! as bool,
      postedTransactionCount: body['postedTransactionCount']! as int,
      entryTransactionCount: body['entryTransactionCount']! as int,
      balances: (body['balances']! as List<dynamic>)
          .cast<Map<String, dynamic>>()
          .map(_balance)
          .toList(growable: false),
    );
  }

  Future<LedgerWriteResult> _post(
    String path,
    Map<String, Object?> body,
  ) async {
    final response = await _send('POST', path, body: body);
    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    return LedgerWriteResult(
      transactionId: payload['transactionId']! as String,
      replayed: payload['replayed']! as bool,
    );
  }

  Future<http.Response> _send(
    String method,
    String path, {
    Map<String, Object?>? body,
  }) async {
    final token = await _accessToken();
    if (token == null || token.isEmpty) {
      throw const ApiLedgerException(401, 'authentication_required');
    }

    final request = http.Request(method, _baseUrl.resolve(path))
      ..headers.addAll({
        'Authorization': 'Bearer $token',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      });
    if (body != null) request.body = jsonEncode(body);

    final response = await http.Response.fromStream(
      await _client.send(request),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      var code = 'api_error';
      try {
        code =
            (jsonDecode(response.body) as Map<String, dynamic>)['code']
                as String? ??
            code;
      } on FormatException {
        // Preserve the stable fallback for non-JSON intermediary responses.
      }
      throw ApiLedgerException(response.statusCode, code);
    }
    return response;
  }

  static AccountBalance _balance(Map<String, dynamic> row) => AccountBalance(
    accountId: row['accountId']! as String,
    currency: row['currency']! as String,
    balanceCents: row['balanceCents']! as int,
  );

  static AccountSummary _account(Map<String, dynamic> row) => AccountSummary(
    id: row['id']! as String,
    name: row['name']! as String,
    kind: row['kind']! as String,
    currency: row['currency']! as String,
    balanceCents: row['balanceCents']! as int,
    archivedAt: row['archivedAt'] == null
        ? null
        : DateTime.parse(row['archivedAt']! as String),
  );

  static LedgerHistoryItem _historyItem(Map<String, dynamic> row) =>
      LedgerHistoryItem(
        transactionId: row['transactionId']! as String,
        kind: row['kind']! as String,
        status: row['status']! as String,
        description: row['description'] as String?,
        reversalOf: row['reversalOf'] as String?,
        occurredOn: DateTime.parse(row['occurredOn']! as String),
        postedAt: DateTime.parse(row['postedAt']! as String),
        createdBy: row['createdBy']! as String,
        accountId: row['accountId']! as String,
        accountName: row['accountName']! as String,
        direction: row['direction']! as String,
        amountCents: row['amountCents']! as int,
        currency: row['currency']! as String,
      );

  static String _date(DateTime value) =>
      value.toIso8601String().substring(0, 10);
}

final class ApiLedgerException implements Exception {
  const ApiLedgerException(this.statusCode, this.code);

  final int statusCode;
  final String code;
}
