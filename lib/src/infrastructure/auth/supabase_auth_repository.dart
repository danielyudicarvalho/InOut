import 'package:inout/src/application/identity/auth_repository.dart';
import 'package:inout/src/domain/identity/authenticated_user.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final class SupabaseAuthRepository implements AuthRepository {
  SupabaseAuthRepository(this._client);

  final SupabaseClient _client;

  @override
  AuthenticatedUser? get currentUser => _mapUser(_client.auth.currentUser);

  @override
  Stream<AuthenticatedUser?> get userChanges => _client.auth.onAuthStateChange
      .map((event) => _mapUser(event.session?.user));

  @override
  Future<void> signIn({required String email, required String password}) async {
    await _client.auth.signInWithPassword(
      email: email.trim(),
      password: password,
    );
  }

  @override
  Future<void> signUp({required String email, required String password}) async {
    await _client.auth.signUp(email: email.trim(), password: password);
  }

  @override
  Future<void> signOut() => _client.auth.signOut();

  static AuthenticatedUser? _mapUser(User? user) {
    final email = user?.email;
    if (user == null || email == null) return null;
    return AuthenticatedUser(id: user.id, email: email);
  }
}
