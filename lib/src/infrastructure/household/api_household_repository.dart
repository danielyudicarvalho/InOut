import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:inout/src/application/household/household_repository.dart';
import 'package:inout/src/core/utils/string_utils.dart';
import 'package:inout/src/domain/household/household.dart';
import 'package:inout/src/infrastructure/http/api_contract.dart';

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
    final response = await _send(ApiMethods.get, ApiContract.households);
    final rows = jsonDecode(response.body) as List<dynamic>;
    return rows
        .cast<Map<String, dynamic>>()
        .map(_mapHousehold)
        .toList(growable: false);
  }

  @override
  Future<Household> create(String name) async {
    final response = await _send(
      ApiMethods.post,
      ApiContract.households,
      body: {ApiFields.name: StringUtils.trimToNull(name) ?? ''},
    );
    return _mapHousehold(jsonDecode(response.body) as Map<String, dynamic>);
  }

  @override
  Future<String> createInvite(String householdId) async {
    final response = await _send(
      ApiMethods.post,
      ApiContract.invitations(householdId),
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return body[ApiFields.code]! as String;
  }

  @override
  Future<Household> acceptInvite(String inviteCode) async {
    final response = await _send(
      ApiMethods.post,
      ApiContract.acceptInvitation,
      body: {ApiFields.code: StringUtils.trimToNull(inviteCode) ?? ''},
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
      throw const ApiHouseholdException(
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
    if (body != null) request.body = jsonEncode(body);

    final streamed = await _client.send(request);
    final response = await http.Response.fromStream(streamed);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      String code = ApiErrorCodes.apiError;
      try {
        code =
            (jsonDecode(response.body) as Map<String, dynamic>)[ApiFields.code]
                as String? ??
            code;
      } on FormatException {
        // Keep the stable fallback when an intermediary returns non-JSON.
      }
      throw ApiHouseholdException(response.statusCode, code);
    }
    return response;
  }

  static Household _mapHousehold(Map<String, dynamic> row) => Household(
    id: row[ApiFields.id]! as String,
    name: row[ApiFields.name]! as String,
  );
}

final class ApiHouseholdException implements Exception {
  const ApiHouseholdException(this.statusCode, this.code);

  final int statusCode;
  final String code;
}
