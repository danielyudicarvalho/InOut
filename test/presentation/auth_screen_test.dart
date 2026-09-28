import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inout/src/application/identity/auth_repository.dart';
import 'package:inout/src/domain/identity/authenticated_user.dart';
import 'package:inout/src/presentation/providers/session_providers.dart';
import 'package:inout/src/presentation/screens/auth_screen.dart';

final class _FakeAuthRepository implements AuthRepository {
  _FakeAuthRepository(this.result);

  final SignUpResult result;
  int signUpCalls = 0;

  @override
  AuthenticatedUser? get currentUser => null;

  @override
  Stream<AuthenticatedUser?> get userChanges => const Stream.empty();

  @override
  Future<void> signIn({required String email, required String password}) async {}

  @override
  Future<SignUpResult> signUp({
    required String email,
    required String password,
  }) async {
    signUpCalls++;
    return result;
  }

  @override
  Future<void> signOut() async {}
}

void main() {
  testWidgets('signup without session shows email confirmation step', (tester) async {
    final auth = _FakeAuthRepository(SignUpResult.confirmationRequired);
    await tester.pumpWidget(ProviderScope(
      overrides: [authRepositoryProvider.overrideWithValue(auth)],
      child: const MaterialApp(home: AuthScreen()),
    ));

    await tester.tap(find.text('Criar uma conta'));
    await tester.enterText(find.byType(TextField).first, 'user@example.com');
    await tester.enterText(find.byType(TextField).last, 'password123');
    await tester.tap(find.text('Criar conta'));
    await tester.pumpAndSettle();

    expect(find.text('Confira seu e-mail'), findsOneWidget);
    expect(find.textContaining('user@example.com'), findsOneWidget);
    expect(find.text('Criar conta'), findsNothing);
    expect(auth.signUpCalls, 1);

    await tester.tap(find.text('Ir para entrar'));
    await tester.pumpAndSettle();
    expect(find.text('Entrar'), findsOneWidget);
  });

  testWidgets('signup with session does not show confirmation step', (tester) async {
    final auth = _FakeAuthRepository(SignUpResult.signedIn);
    await tester.pumpWidget(ProviderScope(
      overrides: [authRepositoryProvider.overrideWithValue(auth)],
      child: const MaterialApp(home: AuthScreen()),
    ));

    await tester.tap(find.text('Criar uma conta'));
    await tester.enterText(find.byType(TextField).first, 'user@example.com');
    await tester.enterText(find.byType(TextField).last, 'password123');
    await tester.tap(find.text('Criar conta'));
    await tester.pumpAndSettle();

    expect(find.text('Confira seu e-mail'), findsNothing);
    expect(auth.signUpCalls, 1);
  });
}
