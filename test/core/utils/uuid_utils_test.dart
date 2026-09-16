import 'package:flutter_test/flutter_test.dart';
import 'package:inout/src/core/utils/uuid_utils.dart';

void main() {
  test('generates an RFC 4122 version 4 UUID', () {
    final value = UuidUtils.v4();

    expect(
      value,
      matches(
        RegExp(
          r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
        ),
      ),
    );
  });
}
