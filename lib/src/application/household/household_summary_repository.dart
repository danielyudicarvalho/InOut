import 'package:inout/src/domain/household/household_summary.dart';

abstract interface class HouseholdSummaryRepository {
  Future<HouseholdSummary> load();
}
