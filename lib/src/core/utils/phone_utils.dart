abstract final class PhoneUtils {
  static String digitsOnly(String value) =>
      value.replaceAll(RegExp('[^0-9]'), '');

  static String? normalizeBrazilian(String value) {
    var digits = digitsOnly(value);
    if (digits.startsWith('55') && digits.length > 11) {
      digits = digits.substring(2);
    }
    return digits.length == 10 || digits.length == 11 ? digits : null;
  }

  static String? formatBrazilian(String value) {
    final digits = normalizeBrazilian(value);
    if (digits == null) return null;
    final prefix = digits.substring(0, 2);
    final subscriber = digits.substring(2);
    final splitAt = subscriber.length - 4;
    return '($prefix) ${subscriber.substring(0, splitAt)}-'
        '${subscriber.substring(splitAt)}';
  }
}
