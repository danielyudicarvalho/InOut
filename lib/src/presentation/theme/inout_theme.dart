import 'package:flutter/material.dart';

@immutable
final class InOutPalette extends ThemeExtension<InOutPalette> {
  const InOutPalette({
    required this.background,
    required this.surface,
    required this.surfaceElevated,
    required this.textPrimary,
    required this.textSecondary,
    required this.border,
    required this.inPrimary,
    required this.inContainer,
    required this.inOnColor,
    required this.outPrimary,
    required this.outContainer,
    required this.outOnColor,
    required this.focus,
    required this.disabled,
    required this.systemError,
    required this.systemWarning,
    required this.systemSuccess,
  });

  final Color background;
  final Color surface;
  final Color surfaceElevated;
  final Color textPrimary;
  final Color textSecondary;
  final Color border;
  final Color inPrimary;
  final Color inContainer;
  final Color inOnColor;
  final Color outPrimary;
  final Color outContainer;
  final Color outOnColor;
  final Color focus;
  final Color disabled;
  final Color systemError;
  final Color systemWarning;
  final Color systemSuccess;

  static const light = InOutPalette(
    background: Color(0xFFF7F8FA), surface: Color(0xFFFFFFFF),
    surfaceElevated: Color(0xFFF0F3F7), textPrimary: Color(0xFF171A21),
    textSecondary: Color(0xFF596273), border: Color(0xFFD8DEE8),
    inPrimary: Color(0xFF1565C0), inContainer: Color(0xFFDCEBFF),
    inOnColor: Color(0xFFFFFFFF), outPrimary: Color(0xFFC62828),
    outContainer: Color(0xFFFFE1DF), outOnColor: Color(0xFFFFFFFF),
    focus: Color(0xFF6B4EFF), disabled: Color(0xFF9AA3B2),
    systemError: Color(0xFF8F1D18), systemWarning: Color(0xFF8A4B00),
    systemSuccess: Color(0xFF166534),
  );

  static const dark = InOutPalette(
    background: Color(0xFF111318), surface: Color(0xFF1A1D24),
    surfaceElevated: Color(0xFF232731), textPrimary: Color(0xFFF3F5F8),
    textSecondary: Color(0xFFB6BECA), border: Color(0xFF39404D),
    inPrimary: Color(0xFF64A8FF), inContainer: Color(0xFF173A63),
    inOnColor: Color(0xFF07182C), outPrimary: Color(0xFFFF7770),
    outContainer: Color(0xFF5B2425), outOnColor: Color(0xFF310405),
    focus: Color(0xFFB7A8FF), disabled: Color(0xFF747C89),
    systemError: Color(0xFFFFB4AB), systemWarning: Color(0xFFFFB95C),
    systemSuccess: Color(0xFF72D995),
  );

  @override
  InOutPalette copyWith() => this;

  @override
  InOutPalette lerp(covariant InOutPalette? other, double t) {
    if (other == null) return this;
    return InOutPalette(
      background: Color.lerp(background, other.background, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceElevated: Color.lerp(surfaceElevated, other.surfaceElevated, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      border: Color.lerp(border, other.border, t)!,
      inPrimary: Color.lerp(inPrimary, other.inPrimary, t)!,
      inContainer: Color.lerp(inContainer, other.inContainer, t)!,
      inOnColor: Color.lerp(inOnColor, other.inOnColor, t)!,
      outPrimary: Color.lerp(outPrimary, other.outPrimary, t)!,
      outContainer: Color.lerp(outContainer, other.outContainer, t)!,
      outOnColor: Color.lerp(outOnColor, other.outOnColor, t)!,
      focus: Color.lerp(focus, other.focus, t)!,
      disabled: Color.lerp(disabled, other.disabled, t)!,
      systemError: Color.lerp(systemError, other.systemError, t)!,
      systemWarning: Color.lerp(systemWarning, other.systemWarning, t)!,
      systemSuccess: Color.lerp(systemSuccess, other.systemSuccess, t)!,
    );
  }
}

extension InOutThemeContext on BuildContext {
  InOutPalette get inOutPalette => Theme.of(this).extension<InOutPalette>()!;
}

abstract final class InOutTheme {
  static ThemeData get light => _build(InOutPalette.light, Brightness.light);
  static ThemeData get dark => _build(InOutPalette.dark, Brightness.dark);

  static ThemeData _build(InOutPalette palette, Brightness brightness) {
    final scheme = ColorScheme.fromSeed(
      seedColor: palette.inPrimary,
      brightness: brightness,
      primary: palette.inPrimary,
      onPrimary: palette.inOnColor,
      primaryContainer: palette.inContainer,
      surface: palette.surface,
      onSurface: palette.textPrimary,
      onSurfaceVariant: palette.textSecondary,
      outline: palette.border,
      error: palette.systemError,
    );
    return ThemeData(
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: palette.background,
      cardColor: palette.surface,
      dividerColor: palette.border,
      disabledColor: palette.disabled,
      focusColor: palette.focus,
      extensions: [palette],
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: palette.surface,
        indicatorColor: palette.inContainer,
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: palette.surface,
        indicatorColor: palette.inContainer,
      ),
      useMaterial3: true,
    );
  }
}
