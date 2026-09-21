import 'package:inout/src/domain/household/household.dart';
import 'package:inout/src/infrastructure/http/api_contract.dart';

abstract final class HouseholdResponseMapper {
  static Household household(Map<String, dynamic> row) => Household(
    id: row[ApiFields.id]! as String,
    name: row[ApiFields.name]! as String,
  );
}
