import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:inout/src/presentation/providers/session_providers.dart';
import 'package:inout/src/presentation/screens/auth_screen.dart';
import 'package:inout/src/presentation/screens/household_access_screen.dart';

final class SessionGateScreen extends ConsumerWidget {
  const SessionGateScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref
        .watch(authenticatedUserProvider)
        .when(
          data: (user) => user == null
              ? const AuthScreen()
              : HouseholdAccessScreen(user: user),
          error: (error, stackTrace) => const Scaffold(
            body: Center(child: Text('Não foi possível restaurar sua sessão.')),
          ),
          loading: () =>
              const Scaffold(body: Center(child: CircularProgressIndicator())),
        );
  }
}
