import 'package:flutter_test/flutter_test.dart';
import 'package:inout/src/core/utils/email_utils.dart';

void main() {
  test('normalizes an email for authentication', () {
    expect(EmailUtils.normalize('  USER@Example.COM '), 'user@example.com');
  });

  test('validates the normalized email shape', () {
    expect(EmailUtils.isValid(' user@example.com '), isTrue);
    expect(EmailUtils.isValid('invalid-email'), isFalse);
  });
}
