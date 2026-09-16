import 'package:flutter_test/flutter_test.dart';
import 'package:inout/src/core/utils/money_utils.dart';

void main() {
  group('MoneyUtils.formatBrl', () {
    test('formats integer cents using Brazilian currency conventions', () {
      expect(MoneyUtils.formatBrl(123456), 'R\$ 1.234,56');
    });

    test('formats zero with two decimal places', () {
      expect(MoneyUtils.formatBrl(0), 'R\$ 0,00');
    });

    test('formats negative values without changing the amount', () {
      expect(MoneyUtils.formatBrl(-123456), '-R\$ 1.234,56');
    });
  });

  group('MoneyUtils.parseBrlToCents', () {
    test('parses Brazilian decimal and thousands separators', () {
      expect(MoneyUtils.parseBrlToCents('1.234,56'), 123456);
      expect(MoneyUtils.parseBrlToCents(' 12,50 '), 1250);
    });

    test('rejects non-numeric values', () {
      expect(MoneyUtils.parseBrlToCents('invalid'), isNull);
    });
  });
}
