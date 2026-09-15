import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:inout/src/infrastructure/financial/api_ledger_repository.dart';

void main() {
  test('creates accounts with an explicit opening balance', () async {
    late http.Request captured;
    final repository = ApiLedgerRepository(
      baseUrl: Uri.parse('https://api.inout.test'),
      accessToken: () async => 'token',
      client: MockClient((request) async {
        captured = request;
        return http.Response(
          jsonEncode({
            'account': {
              'id': 'account-2',
              'name': 'Reserva',
              'kind': 'savings',
              'currency': 'BRL',
              'balanceCents': 25000,
              'archivedAt': null,
            },
            'replayed': false,
          }),
          201,
        );
      }),
    );

    final result = await repository.createAccount(
      householdId: 'household-1',
      id: 'account-2',
      name: 'Reserva',
      kind: 'savings',
      currency: 'BRL',
      initialBalanceCents: 25000,
      openingDate: DateTime(2026, 9, 15),
      idempotencyKey: 'idempotency-account-2',
    );

    expect(result.account.balanceCents, 25000);
    expect(result.replayed, isFalse);
    expect(captured.url.path, '/api/v1/households/household-1/ledger/accounts');
    expect(jsonDecode(captured.body), {
      'id': 'account-2',
      'name': 'Reserva',
      'kind': 'savings',
      'currency': 'BRL',
      'initialBalanceCents': 25000,
      'openingDate': '2026-09-15',
      'idempotencyKey': 'idempotency-account-2',
    });
  });

  test('maps ledger history with author, date, and type', () async {
    final repository = ApiLedgerRepository(
      baseUrl: Uri.parse('https://api.inout.test'),
      accessToken: () async => 'token',
      client: MockClient(
        (_) async => http.Response(
          jsonEncode([
            {
              'transactionId': 'transaction-1',
              'kind': 'openingBalance',
              'status': 'posted',
              'description': 'Saldo inicial',
              'occurredOn': '2026-09-15',
              'postedAt': '2026-09-15T12:00:00Z',
              'createdBy': 'user-1',
              'accountId': 'account-1',
              'accountName': 'Reserva',
              'direction': 'credit',
              'amountCents': 25000,
              'currency': 'BRL',
            },
          ]),
          200,
        ),
      ),
    );

    final history = await repository.getHistory('household-1');

    expect(history.single.createdBy, 'user-1');
    expect(history.single.kind, 'openingBalance');
    expect(history.single.occurredOn, DateTime(2026, 9, 15));
  });

  test('posts income through the versioned API contract', () async {
    late http.Request captured;
    final repository = ApiLedgerRepository(
      baseUrl: Uri.parse('https://api.inout.test'),
      accessToken: () async => 'valid-session-token',
      client: MockClient((request) async {
        captured = request;
        return http.Response(
          jsonEncode({'transactionId': 'transaction-1', 'replayed': false}),
          201,
        );
      }),
    );

    final result = await repository.postIncome(
      householdId: 'household-1',
      accountId: 'account-1',
      categoryId: 'category-1',
      amountCents: 12500,
      currency: 'BRL',
      occurredOn: DateTime(2026, 9, 14),
      idempotencyKey: 'idempotency-1',
      description: 'Salary',
    );

    expect(result.transactionId, 'transaction-1');
    expect(result.replayed, isFalse);
    expect(captured.method, 'POST');
    expect(captured.url.path, '/api/v1/households/household-1/ledger/income');
    expect(captured.headers['Authorization'], 'Bearer valid-session-token');
    expect(jsonDecode(captured.body), {
      'accountId': 'account-1',
      'categoryId': 'category-1',
      'amountCents': 12500,
      'currency': 'BRL',
      'occurredOn': '2026-09-14',
      'idempotencyKey': 'idempotency-1',
      'description': 'Salary',
    });
  });

  test(
    'maps balances and reconciliation without recalculating values',
    () async {
      final repository = ApiLedgerRepository(
        baseUrl: Uri.parse('https://api.inout.test'),
        accessToken: () async => 'token',
        client: MockClient((request) async {
          if (request.url.path.endsWith('/balances')) {
            return http.Response(
              jsonEncode([
                {
                  'accountId': 'account-1',
                  'currency': 'BRL',
                  'balanceCents': -250,
                },
              ]),
              200,
            );
          }
          return http.Response(
            jsonEncode({
              'isConsistent': true,
              'postedTransactionCount': 2,
              'entryTransactionCount': 2,
              'balances': [
                {
                  'accountId': 'account-1',
                  'currency': 'BRL',
                  'balanceCents': -250,
                },
              ],
            }),
            200,
          );
        }),
      );

      final balances = await repository.getBalances('household-1');
      final reconciliation = await repository.reconcile('household-1');

      expect(balances.single.balanceCents, -250);
      expect(reconciliation.isConsistent, isTrue);
      expect(reconciliation.postedTransactionCount, 2);
      expect(reconciliation.entryTransactionCount, 2);
      expect(reconciliation.balances.single.balanceCents, -250);
    },
  );

  test('maps the stable financial API error code', () async {
    final repository = ApiLedgerRepository(
      baseUrl: Uri.parse('https://api.inout.test'),
      accessToken: () async => 'token',
      client: MockClient(
        (_) async => http.Response(
          jsonEncode({'code': 'transaction_not_reversible'}),
          409,
        ),
      ),
    );

    expect(
      repository.reverse(
        householdId: 'household-1',
        transactionId: 'transaction-1',
        occurredOn: DateTime(2026, 9, 15),
        idempotencyKey: 'idempotency-2',
      ),
      throwsA(
        isA<ApiLedgerException>()
            .having((error) => error.statusCode, 'statusCode', 409)
            .having(
              (error) => error.code,
              'code',
              'transaction_not_reversible',
            ),
      ),
    );
  });
}
