import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:inout/src/domain/identity/authenticated_user.dart';
import 'package:inout/src/presentation/providers/session_providers.dart';
import 'package:inout/src/presentation/screens/bootstrap_home_screen.dart';

final class HouseholdAccessScreen extends ConsumerStatefulWidget {
  const HouseholdAccessScreen({required this.user, super.key});

  final AuthenticatedUser user;

  @override
  ConsumerState<HouseholdAccessScreen> createState() =>
      _HouseholdAccessScreenState();
}

final class _HouseholdAccessScreenState
    extends ConsumerState<HouseholdAccessScreen> {
  final _value = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _value.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await action();
      ref.invalidate(householdsProvider);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Não foi possível concluir a operação.');
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final households = ref.watch(householdsProvider);
    return households.when(
      data: (items) {
        if (items.isNotEmpty) {
          return Scaffold(
            appBar: AppBar(
              title: Text(items.first.name),
              actions: [
                IconButton(
                  tooltip: 'Criar convite',
                  onPressed: () {
                    final messenger = ScaffoldMessenger.of(context);
                    _run(() async {
                      final code = await ref
                          .read(householdRepositoryProvider)
                          .createInvite(items.first.id);
                      await Clipboard.setData(ClipboardData(text: code));
                      if (mounted) {
                        messenger.showSnackBar(
                          const SnackBar(
                            content: Text(
                              'Código copiado. Válido por 24 horas.',
                            ),
                          ),
                        );
                      }
                    });
                  },
                  icon: const Icon(Icons.person_add_alt_1),
                ),
                IconButton(
                  tooltip: 'Sair',
                  onPressed: () => ref.read(authRepositoryProvider).signOut(),
                  icon: const Icon(Icons.logout),
                ),
              ],
            ),
            body: const BootstrapHomeScreen(),
          );
        }
        return Scaffold(
          appBar: AppBar(
            title: const Text('Sua residência'),
            actions: [
              IconButton(
                tooltip: 'Sair',
                onPressed: () => ref.read(authRepositoryProvider).signOut(),
                icon: const Icon(Icons.logout),
              ),
            ],
          ),
          body: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('Olá, ${widget.user.email}'),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _value,
                      decoration: const InputDecoration(
                        labelText: 'Nome da residência ou código de convite',
                      ),
                    ),
                    if (_error case final error?) ...[
                      const SizedBox(height: 12),
                      Text(
                        error,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _submitting
                          ? null
                          : () => _run(() async {
                              await ref
                                  .read(householdRepositoryProvider)
                                  .create(_value.text);
                            }),
                      child: const Text('Criar residência'),
                    ),
                    OutlinedButton(
                      onPressed: _submitting
                          ? null
                          : () => _run(() async {
                              await ref
                                  .read(householdRepositoryProvider)
                                  .acceptInvite(_value.text);
                            }),
                      child: const Text('Entrar com convite'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
      error: (error, stackTrace) => const Scaffold(
        body: Center(
          child: Text('Não foi possível carregar suas residências.'),
        ),
      ),
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
    );
  }
}
