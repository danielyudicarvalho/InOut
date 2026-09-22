import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:inout/src/application/financial/ledger_repository.dart';
import 'package:inout/src/infrastructure/financial/dtos/ledger_response_mapper.dart';
import 'package:inout/src/infrastructure/household/api_household_repository.dart';
import 'package:inout/src/infrastructure/http/api_contract.dart';

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
    required String idempotencyKey,
  }) async {
    final response = await _send(
      ApiMethods.post,
      ApiContract.accounts(householdId),
      idempotencyKey: idempotencyKey,
      body: {
        ApiFields.id: id,
        ApiFields.name: name,
        ApiFields.kind: kind,
        ApiFields.currency: currency,
        ApiFields.initialBalanceCents: initialBalanceCents,
        ApiFields.openingDate: _date(openingDate),
      },
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return AccountCreationResult(
      account: LedgerResponseMapper.account(
        body[ApiFields.account]! as Map<String, dynamic>,
      ),
      replayed: body[ApiFields.replayed]! as bool,
    );
  }

  @override
  Future<List<AccountSummary>> getAccounts(
    String householdId, {
    bool includeArchived = false,
  }) async {
    final suffix = includeArchived
        ? '?${ApiQueryFields.includeArchived}=true'
        : '';
    final response = await _send(
      ApiMethods.get,
      '${ApiContract.accounts(householdId)}$suffix',
    );
    return (jsonDecode(response.body) as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .map(LedgerResponseMapper.account)
        .toList(growable: false);
  }

  @override
  Future<void> archiveAccount({
    required String householdId,
    required String accountId,
  }) async {
    await _send(ApiMethods.delete, ApiContract.account(householdId, accountId));
  }

  @override
  Future<List<CategorySummary>> getCategories(
    String householdId, {
    String? flow,
    bool includeArchived = false,
  }) async {
    final query = <String, String>{
      if (includeArchived) ApiQueryFields.includeArchived: 'true',
    };
    if (flow != null) query[ApiQueryFields.flow] = flow;
    final uri = Uri(
      path: ApiContract.categories(householdId),
      queryParameters: query.isEmpty ? null : query,
    );
    final response = await _send(ApiMethods.get, uri.toString());
    return (jsonDecode(response.body) as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .map(LedgerResponseMapper.category)
        .toList(growable: false);
  }

  @override
  Future<CategorySummary> createCategory({
    required String householdId,
    required String id,
    required String name,
    required String flow,
    required String idempotencyKey,
    String? parentId,
  }) async {
    final response = await _send(
      ApiMethods.post,
      ApiContract.categories(householdId),
      idempotencyKey: idempotencyKey,
      body: {
        ApiFields.id: id,
        ApiFields.name: name,
        ApiFields.flow: flow,
        ApiFields.parentId: parentId,
      },
    );
    return LedgerResponseMapper.category(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  @override
  Future<void> archiveCategory({
    required String householdId,
    required String categoryId,
  }) async {
    await _send(
      ApiMethods.delete,
      ApiContract.category(householdId, categoryId),
    );
  }

  @override
  Future<List<LedgerHistoryItem>> getHistory(
    String householdId, {
    int limit = 100,
    DateTime? from,
    DateTime? to,
    String? accountId,
    String? categoryId,
    String? kind,
  }) async {
    final query = <String, String>{ApiQueryFields.limit: '$limit'};
    if (from != null) query[ApiQueryFields.from] = _date(from);
    if (to != null) query[ApiQueryFields.to] = _date(to);
    if (accountId != null) query[ApiQueryFields.accountId] = accountId;
    if (categoryId != null) query[ApiQueryFields.categoryId] = categoryId;
    if (kind != null) query[ApiQueryFields.kind] = kind;
    final uri = Uri(
      path: ApiContract.history(householdId),
      queryParameters: query,
    );
    final response = await _send(ApiMethods.get, uri.toString());
    return (jsonDecode(response.body) as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .map(LedgerResponseMapper.historyItem)
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
  }) => _post(ApiContract.income(householdId), idempotencyKey, {
    ApiFields.accountId: accountId,
    ApiFields.categoryId: categoryId,
    ApiFields.amountCents: amountCents,
    ApiFields.currency: currency,
    ApiFields.occurredOn: _date(occurredOn),
    ApiFields.description: description,
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
  }) => _post(ApiContract.expenses(householdId), idempotencyKey, {
    ApiFields.accountId: accountId,
    ApiFields.categoryId: categoryId,
    ApiFields.amountCents: amountCents,
    ApiFields.currency: currency,
    ApiFields.occurredOn: _date(occurredOn),
    ApiFields.description: description,
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
  }) => _post(ApiContract.transfers(householdId), idempotencyKey, {
    ApiFields.sourceAccountId: sourceAccountId,
    ApiFields.destinationAccountId: destinationAccountId,
    ApiFields.amountCents: amountCents,
    ApiFields.currency: currency,
    ApiFields.occurredOn: _date(occurredOn),
    ApiFields.description: description,
  });

  @override
  Future<LedgerWriteResult> reverse({
    required String householdId,
    required String transactionId,
    required DateTime occurredOn,
    required String idempotencyKey,
    String? description,
  }) =>
      _post(ApiContract.reversals(householdId, transactionId), idempotencyKey, {
        ApiFields.occurredOn: _date(occurredOn),
        ApiFields.description: description,
      });

  @override
  Future<List<AccountBalance>> getBalances(String householdId) async {
    final response = await _send(
      ApiMethods.get,
      ApiContract.balances(householdId),
    );
    return (jsonDecode(response.body) as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .map(LedgerResponseMapper.balance)
        .toList(growable: false);
  }

  @override
  Future<LedgerReconciliation> reconcile(String householdId) async {
    final response = await _send(
      ApiMethods.get,
      ApiContract.reconciliation(householdId),
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return LedgerReconciliation(
      isConsistent: body[ApiFields.isConsistent]! as bool,
      postedTransactionCount: body[ApiFields.postedTransactionCount]! as int,
      entryTransactionCount: body[ApiFields.entryTransactionCount]! as int,
      balances: (body[ApiFields.balances]! as List<dynamic>)
          .cast<Map<String, dynamic>>()
          .map(LedgerResponseMapper.balance)
          .toList(growable: false),
    );
  }

  Future<LedgerWriteResult> _post(
    String path,
    String idempotencyKey,
    Map<String, Object?> body,
  ) async {
    final response = await _send(
      ApiMethods.post,
      path,
      body: body,
      idempotencyKey: idempotencyKey,
    );
    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    return LedgerWriteResult(
      transactionId: payload[ApiFields.transactionId]! as String,
      replayed: payload[ApiFields.replayed]! as bool,
    );
  }

  Future<http.Response> _send(
    String method,
    String path, {
    Map<String, Object?>? body,
    String? idempotencyKey,
  }) async {
    final token = await _accessToken();
    if (token == null || token.isEmpty) {
      throw const ApiLedgerException(
        ApiStatusCodes.unauthorized,
        ApiErrorCodes.authenticationRequired,
      );
    }

    final request = http.Request(method, _baseUrl.resolve(path))
      ..headers.addAll({
        ApiHeaders.authorization: '${ApiHeaders.bearer} $token',
        ApiHeaders.accept: ApiHeaders.json,
        ApiHeaders.contentType: ApiHeaders.json,
      });
    if (idempotencyKey != null) {
      request.headers[ApiHeaders.idempotencyKey] = idempotencyKey;
    }
    if (body != null) request.body = jsonEncode(body);

    late final http.Response response;
    try {
      response = await http.Response.fromStream(await _client.send(request));
    } on http.ClientException {
      throw const ApiLedgerException(
        ApiStatusCodes.networkUnavailable,
        ApiErrorCodes.networkUnavailable,
      );
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      var code = ApiErrorCodes.apiError;
      try {
        code =
            (jsonDecode(response.body) as Map<String, dynamic>)[ApiFields.code]
                as String? ??
            code;
      } on FormatException {
        // Preserve the stable fallback for non-JSON intermediary responses.
      }
      throw ApiLedgerException(response.statusCode, code);
    }
    return response;
  }

  static String _date(DateTime value) =>
      value.toIso8601String().substring(0, 10);
}

final class ApiLedgerException implements Exception {
  const ApiLedgerException(this.statusCode, this.code);

  final int statusCode;
  final String code;
}
