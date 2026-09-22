import 'package:inout/src/core/types/currency_codes.dart';
import 'package:intl/intl.dart';

abstract final class MoneyUtils {
  static final NumberFormat _brl = NumberFormat.currency(
    locale: 'pt_BR',
    name: CurrencyCodes.brl,
    symbol: r'R$',
    decimalDigits: 2,
  );

  static String formatBrl(int cents) => _brl.format(cents / 100);

  static String format(int cents, String currency) {
    if (currency == CurrencyCodes.brl) return formatBrl(cents);
    return NumberFormat.currency(
      locale: 'pt_BR',
      name: currency,
      symbol: currency,
      decimalDigits: 2,
    ).format(cents / 100);
  }

  static int? parseBrlToCents(String value) {
    final normalized = value.trim().replaceAll('.', '').replaceAll(',', '.');
    final amount = double.tryParse(normalized);
    if (amount == null || !amount.isFinite) return null;
    return (amount * 100).round();
  }
}
