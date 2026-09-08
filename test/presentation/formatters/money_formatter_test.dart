import 'package:flutter_test/flutter_test.dart';
import 'package:inout/src/presentation/formatters/money_formatter.dart';

void main() {
  group('MoneyFormatter.formatBrl', () {
    test('formats integer cents using Brazilian currency conventions', () {
      expect(MoneyFormatter.formatBrl(123456), 'R\$ 1.234,56');
    });

    test('formats zero with two decimal places', () {
      expect(MoneyFormatter.formatBrl(0), 'R\$ 0,00');
    });

    test('formats negative values without changing the amount', () {
      expect(MoneyFormatter.formatBrl(-123456), '-R\$ 1.234,56');
    });
  });
}
