import 'package:inout/src/application/household/household_summary_repository.dart';
import 'package:inout/src/domain/household/household_summary.dart';

/// Temporary adapter used only to keep the bootstrap executable.
///
/// GOM-79 will replace it with the PostgreSQL/Supabase implementation without
/// changing the domain or use case.
final class DemoHouseholdSummaryRepository
    implements HouseholdSummaryRepository {
  const DemoHouseholdSummaryRepository();

  @override
  Future<HouseholdSummary> load() async => const HouseholdSummary(
        name: 'Nossa casa',
        balanceInCents: 0,
      );
}
