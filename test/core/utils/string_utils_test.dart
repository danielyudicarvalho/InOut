import 'package:flutter_test/flutter_test.dart';
import 'package:inout/src/core/utils/string_utils.dart';

void main() {
  test('trims text and converts blank values to null', () {
    expect(StringUtils.trimToNull(' description '), 'description');
    expect(StringUtils.trimToNull('   '), isNull);
    expect(StringUtils.trimToNull(null), isNull);
  });
}
