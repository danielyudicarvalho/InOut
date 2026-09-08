import 'package:inout/src/application/household/household_summary_repository.dart';
import 'package:inout/src/domain/household/household_summary.dart';

final class LoadHouseholdSummary {
  const LoadHouseholdSummary(this._repository);

  final HouseholdSummaryRepository _repository;

  Future<HouseholdSummary> call() => _repository.load();
}
