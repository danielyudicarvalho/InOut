import 'package:flutter_test/flutter_test.dart';
import 'package:inout/src/core/utils/phone_utils.dart';

void main() {
  test('normalizes Brazilian phone numbers', () {
    expect(PhoneUtils.normalizeBrazilian('+55 (67) 99999-1234'), '67999991234');
    expect(PhoneUtils.normalizeBrazilian('(67) 3333-1234'), '6733331234');
  });

  test('formats mobile and landline numbers', () {
    expect(PhoneUtils.formatBrazilian('67999991234'), '(67) 99999-1234');
    expect(PhoneUtils.formatBrazilian('6733331234'), '(67) 3333-1234');
  });

  test('rejects an invalid phone number', () {
    expect(PhoneUtils.normalizeBrazilian('123'), isNull);
    expect(PhoneUtils.formatBrazilian('123'), isNull);
  });
}
