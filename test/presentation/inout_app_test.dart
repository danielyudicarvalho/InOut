import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inout/src/presentation/app/inout_app.dart';

void main() {
  testWidgets('renders the bootstrap household screen', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: InOutApp()));
    await tester.pumpAndSettle();

    expect(find.text('InOut'), findsOneWidget);
    expect(find.text('Nossa casa'), findsOneWidget);
    expect(find.text('Saldo inicial: R\$ 0,00'), findsOneWidget);
    expect(find.text('In · Entradas'), findsOneWidget);
    expect(find.text('Out · Saídas'), findsOneWidget);
  });
}
