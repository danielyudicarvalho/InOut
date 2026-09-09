import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:inout/src/application/household/household_repository.dart';
import 'package:inout/src/application/identity/auth_repository.dart';
import 'package:inout/src/domain/household/household.dart';
import 'package:inout/src/domain/identity/authenticated_user.dart';
import 'package:inout/src/infrastructure/auth/supabase_auth_repository.dart';
import 'package:inout/src/infrastructure/household/supabase_household_repository.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => SupabaseAuthRepository(Supabase.instance.client),
);

final householdRepositoryProvider = Provider<HouseholdRepository>(
  (ref) => SupabaseHouseholdRepository(Supabase.instance.client),
);

final authenticatedUserProvider = StreamProvider<AuthenticatedUser?>((ref) {
  final repository = ref.watch(authRepositoryProvider);
  return Stream.value(repository.currentUser).asyncExpand((initial) async* {
    yield initial;
    yield* repository.userChanges;
  });
});

final householdsProvider = FutureProvider.autoDispose<List<Household>>((ref) {
  return ref.watch(householdRepositoryProvider).listMine();
});
