import 'package:intl/intl.dart';

/// Converts monetary values from the domain's integer cents representation
/// into localized text for the Brazilian presentation layer.
abstract final class MoneyFormatter {
  static final NumberFormat _brl = NumberFormat.currency(
    locale: 'pt_BR',
    name: 'BRL',
    symbol: r'R$',
    decimalDigits: 2,
  );

  static String formatBrl(int cents) => _brl.format(cents / 100);
}
