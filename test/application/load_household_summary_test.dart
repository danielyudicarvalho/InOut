import 'package:flutter_test/flutter_test.dart';
import 'package:inout/src/application/household/household_summary_repository.dart';
import 'package:inout/src/application/household/load_household_summary.dart';
import 'package:inout/src/domain/household/household_summary.dart';

void main() {
  test('loads the household through the application port', () async {
    final useCase = LoadHouseholdSummary(_RepositoryStub());

    final result = await useCase();

    expect(result.name, 'Casa de teste');
    expect(result.balanceInCents, 1250);
  });
}

final class _RepositoryStub implements HouseholdSummaryRepository {
  @override
  Future<HouseholdSummary> load() async => const HouseholdSummary(
        name: 'Casa de teste',
        balanceInCents: 1250,
      );
}
