import 'package:go_router/go_router.dart';
import 'package:inout/src/presentation/screens/bootstrap_home_screen.dart';
import 'package:inout/src/presentation/screens/session_gate_screen.dart';

GoRouter createAppRouter({required bool backendConfigured}) => GoRouter(
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => backendConfigured
          ? const SessionGateScreen()
          : const BootstrapHomeScreen(),
    ),
  ],
);
