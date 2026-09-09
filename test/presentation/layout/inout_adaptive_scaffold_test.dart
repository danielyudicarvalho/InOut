import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inout/src/presentation/layout/inout_adaptive_scaffold.dart';
import 'package:inout/src/presentation/theme/inout_theme.dart';

const destinations = [
  InOutDestination(
    label: 'Início',
    icon: Icons.home_outlined,
    selectedIcon: Icons.home,
  ),
  InOutDestination(
    label: 'Configurações',
    icon: Icons.settings_outlined,
    selectedIcon: Icons.settings,
  ),
];

Widget buildSubject() => MaterialApp(
  theme: InOutTheme.light,
  home: InOutAdaptiveScaffold(
    title: 'InOut',
    body: const Text('Conteúdo'),
    destinations: destinations,
    selectedIndex: 0,
    onDestinationSelected: (_) {},
  ),
);

void main() {
  testWidgets('uses bottom navigation on compact screens', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(buildSubject());

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.byType(NavigationRail), findsNothing);
  });

  testWidgets('uses navigation rail on wide screens', (tester) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(buildSubject());

    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
  });
}
