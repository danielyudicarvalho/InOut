import 'package:inout/src/application/household/household_repository.dart';
import 'package:inout/src/domain/household/household.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final class SupabaseHouseholdRepository implements HouseholdRepository {
  SupabaseHouseholdRepository(this._client);

  final SupabaseClient _client;

  @override
  Future<List<Household>> listMine() async {
    final rows = await _client
        .from('households')
        .select('id,name')
        .order('name');
    return rows.map(_mapHousehold).toList(growable: false);
  }

  @override
  Future<Household> create(String name) async {
    final row = await _client.rpc<Object?>(
      'create_household',
      params: {'household_name': name.trim()},
    );
    return _mapHousehold(row! as Map<String, dynamic>);
  }

  @override
  Future<String> createInvite(String householdId) async {
    final value = await _client.rpc<Object?>(
      'create_household_invite',
      params: {'target_household_id': householdId},
    );
    return value! as String;
  }

  @override
  Future<Household> acceptInvite(String inviteCode) async {
    final row = await _client.rpc<Object?>(
      'accept_household_invite',
      params: {'invite_code': inviteCode.trim()},
    );
    return _mapHousehold(row! as Map<String, dynamic>);
  }

  static Household _mapHousehold(Map<String, dynamic> row) =>
      Household(id: row['id']! as String, name: row['name']! as String);
}
