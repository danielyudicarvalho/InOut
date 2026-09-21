import 'package:flutter/material.dart';

final class SyncStatusBanner extends StatelessWidget {
  const SyncStatusBanner({required this.offline, super.key});

  final bool offline;

  @override
  Widget build(BuildContext context) {
    if (!offline) return const SizedBox.shrink();

    return const MaterialBanner(
      leading: Icon(Icons.cloud_off_outlined),
      content: Text(
        'Sem conexão. Os dados exibidos podem estar desatualizados e nenhuma '
        'gravação será confirmada até a conexão voltar.',
      ),
      actions: [SizedBox.shrink()],
    );
  }
}
