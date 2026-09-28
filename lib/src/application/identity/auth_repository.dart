import 'package:inout/src/domain/identity/authenticated_user.dart';

enum SignUpResult { signedIn, confirmationRequired }

abstract interface class AuthRepository {
  AuthenticatedUser? get currentUser;

  Stream<AuthenticatedUser?> get userChanges;

  Future<void> signIn({required String email, required String password});

  Future<SignUpResult> signUp({
    required String email,
    required String password,
  });

  Future<void> signOut();
}
