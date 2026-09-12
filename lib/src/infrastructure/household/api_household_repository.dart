import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:inout/src/application/household/household_repository.dart';
import 'package:inout/src/domain/household/household.dart';

typedef AccessTokenProvider = Future<String?> Function();

final class ApiHouseholdRepository implements HouseholdRepository {
  ApiHouseholdRepository({
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
  Future<List<Household>> listMine() async {
    final response = await _send('GET', '/api/v1/households');
    final rows = jsonDecode(response.body) as List<dynamic>;
    return rows
        .cast<Map<String, dynamic>>()
        .map(_mapHousehold)
        .toList(growable: false);
  }

  @override
  Future<Household> create(String name) async {
    final response = await _send(
      'POST',
      '/api/v1/households',
      body: {'name': name.trim()},
    );
    return _mapHousehold(jsonDecode(response.body) as Map<String, dynamic>);
  }

  @override
  Future<String> createInvite(String householdId) async {
    final response = await _send(
      'POST',
      '/api/v1/households/$householdId/invitations',
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return body['code']! as String;
  }

  @override
  Future<Household> acceptInvite(String inviteCode) async {
    final response = await _send(
      'POST',
      '/api/v1/household-invitations/accept',
      body: {'code': inviteCode.trim()},
    );
    return _mapHousehold(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<http.Response> _send(
    String method,
    String path, {
    Map<String, Object?>? body,
  }) async {
    final token = await _accessToken();
    if (token == null || token.isEmpty) {
      throw const ApiHouseholdException(401, 'authentication_required');
    }

    final request = http.Request(method, _baseUrl.resolve(path))
      ..headers.addAll({
        'Authorization': 'Bearer $token',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      });
    if (body != null) request.body = jsonEncode(body);

    final streamed = await _client.send(request);
    final response = await http.Response.fromStream(streamed);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      String code = 'api_error';
      try {
        code =
            (jsonDecode(response.body) as Map<String, dynamic>)['code']
                as String? ??
            code;
      } on FormatException {
        // Keep the stable fallback when an intermediary returns non-JSON.
      }
      throw ApiHouseholdException(response.statusCode, code);
    }
    return response;
  }

  static Household _mapHousehold(Map<String, dynamic> row) =>
      Household(id: row['id']! as String, name: row['name']! as String);
}

final class ApiHouseholdException implements Exception {
  const ApiHouseholdException(this.statusCode, this.code);

  final int statusCode;
  final String code;
}
