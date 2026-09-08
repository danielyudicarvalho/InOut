import 'package:go_router/go_router.dart';
import 'package:inout/src/presentation/screens/bootstrap_home_screen.dart';

final appRouter = GoRouter(
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const BootstrapHomeScreen(),
    ),
  ],
);
