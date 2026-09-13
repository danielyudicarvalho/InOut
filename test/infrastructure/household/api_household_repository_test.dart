import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:inout/src/infrastructure/household/api_household_repository.dart';

void main() {
  test('lists households through API with the Supabase bearer token', () async {
    late http.Request captured;
    final repository = ApiHouseholdRepository(
      baseUrl: Uri.parse('https://api.inout.test'),
      accessToken: () async => 'valid-session-token',
      client: MockClient((request) async {
        captured = request;
        return http.Response(
          jsonEncode([
            {'id': 'household-1', 'name': 'Minha casa'},
          ]),
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );

    final households = await repository.listMine();

    expect(households.single.name, 'Minha casa');
    expect(captured.url.path, '/api/v1/households');
    expect(captured.headers['Authorization'], 'Bearer valid-session-token');
  });

  test('maps the stable API error code', () async {
    final repository = ApiHouseholdRepository(
      baseUrl: Uri.parse('https://api.inout.test'),
      accessToken: () async => 'token',
      client: MockClient(
        (_) async => http.Response(jsonEncode({'code': 'household_full'}), 409),
      ),
    );

    expect(
      repository.createInvite('household-1'),
      throwsA(
        isA<ApiHouseholdException>()
            .having(
              (ApiHouseholdException error) => error.statusCode,
              'statusCode',
              409,
            )
            .having(
              (ApiHouseholdException error) => error.code,
              'code',
              'household_full',
            ),
      ),
    );
  });
}
