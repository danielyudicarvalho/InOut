import 'package:flutter/material.dart';

abstract final class InOutColors {
  static const inPrimary = Color(0xFF1565C0);
  static const outPrimary = Color(0xFFC62828);
  static const systemError = Color(0xFFB3261E);
  static const lightBackground = Color(0xFFF7F8FA);
  static const darkBackground = Color(0xFF111318);
}

abstract final class InOutTheme {
  static ThemeData get light => ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: InOutColors.inPrimary,
          brightness: Brightness.light,
          error: InOutColors.systemError,
        ),
        scaffoldBackgroundColor: InOutColors.lightBackground,
        useMaterial3: true,
      );

  static ThemeData get dark => ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: InOutColors.inPrimary,
          brightness: Brightness.dark,
          error: InOutColors.systemError,
        ),
        scaffoldBackgroundColor: InOutColors.darkBackground,
        useMaterial3: true,
      );
}
