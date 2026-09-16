abstract final class EmailUtils {
  static final RegExp _pattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  static String normalize(String value) => value.trim().toLowerCase();

  static bool isValid(String value) => _pattern.hasMatch(normalize(value));
}
