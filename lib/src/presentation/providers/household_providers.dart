import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:inout/src/application/household/household_summary_repository.dart';
import 'package:inout/src/application/household/load_household_summary.dart';
import 'package:inout/src/domain/household/household_summary.dart';
import 'package:inout/src/infrastructure/household/demo_household_summary_repository.dart';

final householdSummaryRepositoryProvider = Provider<HouseholdSummaryRepository>(
  (ref) {
    return const DemoHouseholdSummaryRepository();
  },
);

final loadHouseholdSummaryProvider = Provider<LoadHouseholdSummary>((ref) {
  return LoadHouseholdSummary(ref.watch(householdSummaryRepositoryProvider));
});

final householdSummaryProvider = FutureProvider<HouseholdSummary>((ref) {
  return ref.watch(loadHouseholdSummaryProvider).call();
});
