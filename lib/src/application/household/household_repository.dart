import 'package:inout/src/domain/household/household.dart';

abstract interface class HouseholdRepository {
  Future<List<Household>> listMine();

  Future<Household> create(String name);

  Future<String> createInvite(String householdId);

  Future<Household> acceptInvite(String inviteCode);
}
