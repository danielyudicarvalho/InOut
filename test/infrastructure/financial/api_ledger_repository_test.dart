import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:inout/src/infrastructure/financial/api_ledger_repository.dart';

void main() {
  test('posts an expense with bearer token and idempotency key', () async {
    late http.Request captured;
    final repository = ApiLedgerRepository(
      baseUrl: Uri.parse('https://api.inout.test'),
      accessToken: () async => 'access-token',
      client: MockClient((request) async {
        captured = request;
        return http.Response(
          jsonEncode({
            'transactionId': 'b6a42b4c-a98f-42c8-b164-a693fb69dd90',
            'replayed': false,
          }),
          201,
          headers: {'content-type': 'application/json'},
        );
      }),
    );

    final result = await repository.postExpense(
      householdId: 'household-id',
      accountId: 'account-id',
      categoryId: 'category-id',
      amountCents: 4990,
      currency: 'BRL',
      occurredOn: DateTime(2026, 9, 14),
      idempotencyKey: '4e88b287-5fc3-43cb-8d81-8918869dbe44',
      description: 'Mercado',
    );

    expect(
      captured.url.path,
      '/api/v1/households/household-id/ledger/expenses',
    );
    expect(captured.headers['authorization'], 'Bearer access-token');
    final body = jsonDecode(captured.body) as Map<String, dynamic>;
    expect(body['amountCents'], 4990);
    expect(body['occurredOn'], '2026-09-14');
    expect(
      body['idempotencyKey'],
      '4e88b287-5fc3-43cb-8d81-8918869dbe44',
    );
    expect(result.replayed, isFalse);
  });

  test('maps stable Problem Details error code', () async {
    final repository = ApiLedgerRepository(
      baseUrl: Uri.parse('https://api.inout.test'),
      accessToken: () async => 'access-token',
      client: MockClient(
        (_) async => http.Response(
          jsonEncode({'code': 'invalid_account'}),
          400,
          headers: {'content-type': 'application/problem+json'},
        ),
      ),
    );

    await expectLater(
      repository.getBalances('household-id'),
      throwsA(
        isA<ApiLedgerException>()
            .having((error) => error.statusCode, 'statusCode', 400)
            .having((error) => error.code, 'code', 'invalid_account'),
      ),
    );
  });

  test('fails locally when there is no access token', () async {
    final repository = ApiLedgerRepository(
      baseUrl: Uri.parse('https://api.inout.test'),
      accessToken: () async => null,
      client: MockClient((_) async => throw StateError('must not call HTTP')),
    );

    await expectLater(
      repository.getBalances('household-id'),
      throwsA(
        isA<ApiLedgerException>()
            .having((error) => error.statusCode, 'statusCode', 401)
            .having(
              (error) => error.code,
              'code',
              'authentication_required',
            ),
      ),
    );
  });
}
