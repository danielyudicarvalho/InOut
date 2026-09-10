import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:inout/src/presentation/providers/session_providers.dart';

final class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

final class _AuthScreenState extends ConsumerState<AuthScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _submitting = false;
  bool _signUp = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_email.text.trim().isEmpty || _password.text.length < 8) {
      setState(
        () => _error = 'Informe um e-mail e uma senha com 8 caracteres.',
      );
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final auth = ref.read(authRepositoryProvider);
      if (_signUp) {
        await auth.signUp(email: _email.text, password: _password.text);
      } else {
        await auth.signIn(email: _email.text, password: _password.text);
      }
    } catch (_) {
      if (mounted) setState(() => _error = 'Não foi possível autenticar.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: AutofillGroup(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'InOut',
                    style: Theme.of(context).textTheme.headlineLarge,
                  ),
                  const SizedBox(height: 24),
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email],
                    decoration: const InputDecoration(labelText: 'E-mail'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _password,
                    obscureText: true,
                    autofillHints: const [AutofillHints.password],
                    onSubmitted: (_) => _submit(),
                    decoration: const InputDecoration(labelText: 'Senha'),
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
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _submitting ? null : _submit,
                    child: Text(_signUp ? 'Criar conta' : 'Entrar'),
                  ),
                  TextButton(
                    onPressed: _submitting
                        ? null
                        : () => setState(() => _signUp = !_signUp),
                    child: Text(
                      _signUp ? 'Já tenho uma conta' : 'Criar uma conta',
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
