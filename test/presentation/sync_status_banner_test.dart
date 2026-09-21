import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inout/src/presentation/components/sync_status_banner.dart';

void main() {
  testWidgets('shows that writes are unconfirmed while offline', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: SyncStatusBanner(offline: true)),
      ),
    );

    expect(find.byIcon(Icons.cloud_off_outlined), findsOneWidget);
    expect(
      find.textContaining('nenhuma gravação será confirmada'),
      findsOneWidget,
    );
  });

  testWidgets('stays hidden while synchronized', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: SyncStatusBanner(offline: false)),
      ),
    );

    expect(find.byType(MaterialBanner), findsNothing);
  });
}
