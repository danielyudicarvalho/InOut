import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:inout/src/domain/transaction/financial_flow.dart';
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
    });
    expect(captured.headers['Idempotency-Key'], 'idempotency-account-2');
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
              'reversalOf': null,
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
    expect(history.single.reversalOf, isNull);
    expect(history.single.occurredOn, DateTime(2026, 9, 15));
  });

  test('maps the original transaction referenced by a reversal', () async {
    final repository = ApiLedgerRepository(
      baseUrl: Uri.parse('https://api.inout.test'),
      accessToken: () async => 'token',
      client: MockClient(
        (_) async => http.Response(
          jsonEncode([
            {
              'transactionId': 'reversal-1',
              'kind': 'reversal',
              'status': 'posted',
              'description': 'Correção',
              'reversalOf': 'transaction-1',
              'occurredOn': '2026-09-16',
              'postedAt': '2026-09-16T12:00:00Z',
              'createdBy': 'user-1',
              'accountId': 'account-1',
              'accountName': 'Reserva',
              'direction': 'debit',
              'amountCents': 25000,
              'currency': 'BRL',
            },
          ]),
          200,
        ),
      ),
    );

    final reversal = (await repository.getHistory('household-1')).single;

    expect(reversal.kind, 'reversal');
    expect(reversal.reversalOf, 'transaction-1');
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
    expect(captured.headers['Idempotency-Key'], 'idempotency-1');
    expect(jsonDecode(captured.body), {
      'accountId': 'account-1',
      'categoryId': 'category-1',
      'amountCents': 12500,
      'currency': 'BRL',
      'occurredOn': '2026-09-14',
      'description': 'Salary',
    });
  });

  test('loads flow categories and posts an expense', () async {
    final requests = <http.Request>[];
    final repository = ApiLedgerRepository(
      baseUrl: Uri.parse('https://api.inout.test'),
      accessToken: () async => 'token',
      client: MockClient((request) async {
        requests.add(request);
        if (request.method == 'GET') {
          return http.Response(
            jsonEncode([
              {'id': 'category-1', 'name': 'Alimentação', 'flow': 'expense'},
            ]),
            200,
          );
        }
        return http.Response(
          jsonEncode({'transactionId': 'expense-1', 'replayed': false}),
          201,
        );
      }),
    );

    final categories = await repository.getCategories(
      'household-1',
      flow: FinancialFlow.expense,
    );
    await repository.postExpense(
      householdId: 'household-1',
      accountId: 'account-1',
      categoryId: categories.single.id,
      amountCents: 2590,
      currency: 'BRL',
      occurredOn: DateTime(2026, 9, 16),
      idempotencyKey: 'idempotency-expense-1',
      description: 'Mercado',
    );

    expect(requests.first.url.queryParameters, {'flow': 'expense'});
    expect(
      requests.last.url.path,
      '/api/v1/households/household-1/ledger/expenses',
    );
    expect(jsonDecode(requests.last.body), containsPair('amountCents', 2590));
    expect(requests.last.headers['Idempotency-Key'], 'idempotency-expense-1');
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

  test('reports an unconfirmed write when the network is unavailable', () {
    final repository = ApiLedgerRepository(
      baseUrl: Uri.parse('https://api.inout.test'),
      accessToken: () async => 'token',
      client: MockClient((_) async {
        throw http.ClientException('Network unavailable');
      }),
    );

    expect(
      repository.postExpense(
        householdId: 'household-1',
        accountId: 'account-1',
        categoryId: 'category-1',
        amountCents: 100,
        currency: 'BRL',
        occurredOn: DateTime(2026, 9, 21),
        idempotencyKey: 'intent-1',
      ),
      throwsA(
        isA<ApiLedgerException>()
            .having((error) => error.statusCode, 'statusCode', 0)
            .having((error) => error.code, 'code', 'network_unavailable'),
      ),
    );
  });
}
