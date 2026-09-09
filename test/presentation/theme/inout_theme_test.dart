import 'package:flutter_test/flutter_test.dart';
import 'package:inout/src/presentation/theme/inout_theme.dart';

void main() {
  test('light and dark themes expose their own semantic tokens', () {
    final light = InOutTheme.light.extension<InOutPalette>()!;
    final dark = InOutTheme.dark.extension<InOutPalette>()!;

    expect(light.background, isNot(dark.background));
    expect(light.inPrimary, isNot(dark.inPrimary));
    expect(light.outPrimary, isNot(dark.outPrimary));
    expect(light.systemError, isNot(light.outPrimary));
    expect(dark.systemError, isNot(dark.outPrimary));
  });
}
