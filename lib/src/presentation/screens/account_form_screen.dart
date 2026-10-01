import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:inout/src/application/financial/dtos/ledger_models.dart';
import 'package:inout/src/core/types/currency_codes.dart';
import 'package:inout/src/core/utils/money_utils.dart';
import 'package:inout/src/core/utils/string_utils.dart';
import 'package:inout/src/core/utils/uuid_utils.dart';
import 'package:inout/src/domain/household/household.dart';
import 'package:inout/src/infrastructure/financial/api_ledger_repository.dart';
import 'package:inout/src/presentation/providers/household_providers.dart';
import 'package:inout/src/presentation/providers/session_providers.dart';

final class AccountFormScreen extends ConsumerStatefulWidget {
  const AccountFormScreen({
    required this.household,
    this.accountToEdit,
    super.key,
  });

  final Household household;
  final AccountSummary? accountToEdit;

  @override
  ConsumerState<AccountFormScreen> createState() => _AccountFormScreenState();
}

final class _AccountFormScreenState extends ConsumerState<AccountFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _initialBalance = TextEditingController();

  String _kind = 'checking';
  String _currency = CurrencyCodes.brl;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.accountToEdit case final account?) {
      _name.text = account.name;
      _kind = account.kind.toLowerCase();
      _currency = account.currency;
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _initialBalance.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });

    final name = StringUtils.trimToNull(_name.text)!;
    final repository = ref.read(ledgerRepositoryProvider);

    try {
      if (widget.accountToEdit case final account?) {
        await repository.updateAccountMetadata(
          householdId: widget.household.id,
          accountId: account.id,
          name: name,
          kind: _kind,
        );
      } else {
        final initialCents = MoneyUtils.parseBrlToCents(_initialBalance.text) ?? 0;
        final accountId = UuidUtils.v4();
        final idempotencyKey = UuidUtils.v4();

        await repository.createAccount(
          householdId: widget.household.id,
          id: accountId,
          name: name,
          kind: _kind,
          currency: _currency,
          initialBalanceCents: initialCents,
          openingDate: DateTime.now(),
          idempotencyKey: idempotencyKey,
        );
      }

      ref.invalidate(ledgerAccountsProvider(widget.household.id));
      ref.invalidate(financialDashboardProvider);

      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } on ApiLedgerException catch (error) {
      if (mounted) {
        setState(() => _error = _messageFor(error.code, isEditing: widget.accountToEdit != null));
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = widget.accountToEdit != null
              ? 'Não foi possível atualizar a conta. Tente novamente.'
              : 'Não foi possível criar a conta. Tente novamente.',
        );
      }
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEditing = widget.accountToEdit != null;
    return Scaffold(
      appBar: AppBar(title: Text(isEditing ? 'Editar conta' : 'Nova conta')),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Form(
                key: _formKey,
                child: ListView(
                  children: [
                    TextFormField(
                      controller: _name,
                      autofocus: true,
                      maxLength: 80,
                      decoration: const InputDecoration(
                        labelText: 'Nome da conta',
                        helperText:
                            'Ex.: Carteira, Conta Corrente Itaú, Poupança',
                      ),
                      validator: (value) => StringUtils.trimToNull(value) == null
                          ? 'Informe o nome da conta.'
                          : null,
                    ),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<String>(
                      value: _kind,
                      decoration: const InputDecoration(
                        labelText: 'Tipo de conta',
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: 'checking',
                          child: Text('Conta corrente'),
                        ),
                        DropdownMenuItem(
                          value: 'cash',
                          child: Text('Carteira (Dinheiro em espécie)'),
                        ),
                        DropdownMenuItem(
                          value: 'savings',
                          child: Text('Poupança'),
                        ),
                        DropdownMenuItem(
                          value: 'investment',
                          child: Text('Investimento'),
                        ),
                        DropdownMenuItem(value: 'other', child: Text('Outras')),
                      ],
                      onChanged: (value) {
                        if (value != null) {
                          setState(() => _kind = value);
                        }
                      },
                    ),
                    const SizedBox(height: 16),
                    if (!isEditing) ...[
                      DropdownButtonFormField<String>(
                        value: _currency,
                        decoration: const InputDecoration(labelText: 'Moeda'),
                        items: const [
                          DropdownMenuItem(
                            value: CurrencyCodes.brl,
                            child: Text('BRL (R\$) - Real Brasileiro'),
                          ),
                          DropdownMenuItem(
                            value: CurrencyCodes.usd,
                            child: Text('USD (\$) - Dólar Americano'),
                          ),
                          DropdownMenuItem(
                            value: CurrencyCodes.eur,
                            child: Text('EUR (€) - Euro'),
                          ),
                        ],
                        onChanged: (value) {
                          if (value != null) {
                            setState(() => _currency = value);
                          }
                        },
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _initialBalance,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(RegExp(r'[0-9,.]')),
                        ],
                        decoration: const InputDecoration(
                          labelText: 'Saldo inicial (opcional)',
                          prefixText: 'R\$ ',
                          helperText: 'Deixe em blank se for zero.',
                        ),
                      ),
                      const SizedBox(height: 24),
                    ] else ...[
                      InputDecorator(
                        decoration: const InputDecoration(
                          labelText: 'Moeda',
                          helperText: 'Moeda e histórico financeiro não podem ser alterados.',
                        ),
                        child: Text(_currency.toUpperCase()),
                      ),
                      const SizedBox(height: 24),
                    ],
                    if (_error case final error?) ...[
                      Text(
                        error,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                    FilledButton.icon(
                      onPressed: _saving ? null : _submit,
                      icon: const Icon(Icons.check),
                      label: Text(
                        _saving
                            ? 'Salvando…'
                            : (isEditing ? 'Salvar alterações' : 'Criar conta'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  static String _messageFor(String code, {bool isEditing = false}) => switch (code) {
    'account_name_conflict' =>
      'Já existe uma conta ativa com este nome na residência.',
    'account_archived' =>
      'Contas arquivadas não podem ser alteradas.',
    'network_unavailable' =>
      isEditing
          ? 'Sem conexão. A conta não foi atualizada; tente novamente.'
          : 'Sem conexão. A conta não foi criada; tente novamente.',
    _ =>
      isEditing
          ? 'Não foi possível atualizar a conta. Verifique os dados e tente novamente.'
          : 'Não foi possível criar a conta. Verifique os dados e tente novamente.',
  };
}
