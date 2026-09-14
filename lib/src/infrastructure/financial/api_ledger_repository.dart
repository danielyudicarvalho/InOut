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
  Future<LedgerWriteResult> postIncome({
    required String householdId,
    required String accountId,
    required String categoryId,
    required int amountCents,
    required String currency,
    required DateTime occurredOn,
    required String idempotencyKey,
    String? description,
  }) => _post(
    '/api/v1/households/$householdId/ledger/income',
    {
      'accountId': accountId,
      'categoryId': categoryId,
      'amountCents': amountCents,
      'currency': currency,
      'occurredOn': _date(occurredOn),
      'idempotencyKey': idempotencyKey,
      'description': description,
    },
  );

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
  }) => _post(
    '/api/v1/households/$householdId/ledger/expenses',
    {
      'accountId': accountId,
      'categoryId': categoryId,
      'amountCents': amountCents,
      'currency': currency,
      'occurredOn': _date(occurredOn),
      'idempotencyKey': idempotencyKey,
      'description': description,
    },
  );

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
  }) => _post(
    '/api/v1/households/$householdId/ledger/transfers',
    {
      'sourceAccountId': sourceAccountId,
      'destinationAccountId': destinationAccountId,
      'amountCents': amountCents,
      'currency': currency,
      'occurredOn': _date(occurredOn),
      'idempotencyKey': idempotencyKey,
      'description': description,
    },
  );

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

    final response = await http.Response.fromStream(await _client.send(request));
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

  static String _date(DateTime value) =>
      value.toIso8601String().substring(0, 10);
}

final class ApiLedgerException implements Exception {
  const ApiLedgerException(this.statusCode, this.code);

  final int statusCode;
  final String code;
}
