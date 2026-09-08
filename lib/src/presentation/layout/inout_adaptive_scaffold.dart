import 'package:flutter/material.dart';
import 'package:inout/src/presentation/layout/inout_breakpoints.dart';

final class InOutDestination {
  const InOutDestination({required this.label, required this.icon, required this.selectedIcon});
  final String label;
  final IconData icon;
  final IconData selectedIcon;
}

final class InOutAdaptiveScaffold extends StatelessWidget {
  const InOutAdaptiveScaffold({
    required this.title, required this.body, required this.destinations,
    required this.selectedIndex, required this.onDestinationSelected, super.key,
  });
  final String title;
  final Widget body;
  final List<InOutDestination> destinations;
  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, constraints) {
          final usesRail = constraints.maxWidth >= InOutBreakpoints.compact;
          final content = Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: InOutBreakpoints.contentMaxWidth),
              child: body,
            ),
          );
          return Scaffold(
            appBar: usesRail ? null : AppBar(title: Text(title)),
            body: usesRail
                ? Row(children: [
                    NavigationRail(
                      selectedIndex: selectedIndex,
                      onDestinationSelected: onDestinationSelected,
                      extended: constraints.maxWidth >= InOutBreakpoints.expanded,
                      leading: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        child: Text(title, style: Theme.of(context).textTheme.titleLarge),
                      ),
                      destinations: destinations.map((item) => NavigationRailDestination(
                        icon: Icon(item.icon), selectedIcon: Icon(item.selectedIcon),
                        label: Text(item.label),
                      )).toList(growable: false),
                    ),
                    const VerticalDivider(width: 1),
                    Expanded(child: content),
                  ])
                : content,
            bottomNavigationBar: usesRail ? null : NavigationBar(
              selectedIndex: selectedIndex,
              onDestinationSelected: onDestinationSelected,
              destinations: destinations.map((item) => NavigationDestination(
                icon: Icon(item.icon), selectedIcon: Icon(item.selectedIcon), label: item.label,
              )).toList(growable: false),
            ),
          );
        },
      );
}
