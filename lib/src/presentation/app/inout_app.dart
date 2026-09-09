import 'package:flutter/material.dart';
import 'package:inout/src/presentation/router/app_router.dart';
import 'package:inout/src/presentation/theme/inout_theme.dart';

final class InOutApp extends StatelessWidget {
  const InOutApp({this.backendConfigured = false, super.key});

  final bool backendConfigured;

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'InOut',
      debugShowCheckedModeBanner: false,
      theme: InOutTheme.light,
      darkTheme: InOutTheme.dark,
      themeMode: ThemeMode.system,
      routerConfig: createAppRouter(backendConfigured: backendConfigured),
    );
  }
}
