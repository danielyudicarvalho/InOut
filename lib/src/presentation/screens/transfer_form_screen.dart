import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:inout/src/application/financial/ledger_repository.dart';
import 'package:inout/src/core/utils/money_utils.dart';
import 'package:inout/src/core/utils/string_utils.dart';
import 'package:inout/src/core/utils/uuid_utils.dart';
import 'package:inout/src/domain/household/household.dart';
import 'package:inout/src/infrastructure/financial/api_ledger_repository.dart';
import 'package:inout/src/presentation/providers/session_providers.dart';

final class TransferFormScreen extends ConsumerStatefulWidget {
  const TransferFormScreen({required this.household, super.key});

  final Household household;

  @override
  ConsumerState<TransferFormScreen> createState() => _TransferFormScreenState();
}

final class _TransferFormScreenState extends ConsumerState<TransferFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amount = TextEditingController();
  final _description = TextEditingController();
  String? _sourceId;
  String? _destinationId;
  String? _pendingSignature;
  String? _pendingKey;
  String? _error;
  bool _saving = false;

  @override
  void dispose() {
    _amount.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _submit(List<AccountSummary> accounts) async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    final occurredOn = DateTime.now();
    final cents = MoneyUtils.parseBrlToCents(_amount.text)!;
    final description = StringUtils.trimToNull(_description.text);
    final currency = accounts.singleWhere((a) => a.id == _sourceId).currency;
    final signature = [
      widget.household.id,
      _sourceId,
      _destinationId,
      cents,
      currency,
      occurredOn.toIso8601String().substring(0, 10),
      description,
    ].join('|');
    if (_pendingSignature != signature) {
      _pendingSignature = signature;
      _pendingKey = UuidUtils.v4();
    }
    try {
      await ref
          .read(ledgerRepositoryProvider)
          .postTransfer(
            householdId: widget.household.id,
            sourceAccountId: _sourceId!,
            destinationAccountId: _destinationId!,
            amountCents: cents,
            currency: currency,
            occurredOn: occurredOn,
            idempotencyKey: _pendingKey!,
            description: description,
          );
      ref.invalidate(ledgerAccountsProvider(widget.household.id));
      if (mounted) Navigator.of(context).pop(true);
    } on ApiLedgerException catch (error) {
      if (mounted)
        setState(
          () => _error = error.code == 'network_unavailable'
              ? 'Sem conexão. A transferência não foi confirmada; tente novamente.'
              : 'Não foi possível transferir. Confira as contas e o saldo.',
        );
    } catch (_) {
      if (mounted)
        setState(
          () => _error = 'Não foi possível transferir. Tente novamente.',
        );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final accounts = ref.watch(ledgerAccountsProvider(widget.household.id));
    return Scaffold(
      appBar: AppBar(title: const Text('Transferir entre contas')),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: accounts.when(
                error: (_, _) => const Center(
                  child: Text('Não foi possível carregar as contas.'),
                ),
                loading: () => const Center(child: CircularProgressIndicator()),
                data: (items) => items.length < 2
                    ? const Center(
                        child: Text(
                          'Crie duas contas ativas para fazer uma transferência.',
                        ),
                      )
                    : Form(
                        key: _formKey,
                        child: ListView(
                          children: [
                            TextFormField(
                              controller: _amount,
                              autofocus: true,
                              keyboardType:
                                  const TextInputType.numberWithOptions(
                                    decimal: true,
                                  ),
                              inputFormatters: [
                                FilteringTextInputFormatter.allow(
                                  RegExp(r'[0-9,.]'),
                                ),
                              ],
                              decoration: const InputDecoration(
                                labelText: 'Valor',
                                prefixText: 'R\$ ',
                              ),
                              validator: (value) =>
                                  (MoneyUtils.parseBrlToCents(value ?? '') ??
                                          0) <=
                                      0
                                  ? 'Informe um valor maior que zero.'
                                  : null,
                            ),
                            const SizedBox(height: 16),
                            DropdownButtonFormField<String>(
                              initialValue: _sourceId,
                              decoration: const InputDecoration(
                                labelText: 'Conta de origem',
                              ),
                              items: items
                                  .map(
                                    (a) => DropdownMenuItem(
                                      value: a.id,
                                      child: Text('${a.name} (${a.currency})'),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (value) => setState(() {
                                _sourceId = value;
                                if (_destinationId == value)
                                  _destinationId = null;
                              }),
                              validator: (value) =>
                                  value == null ? 'Selecione a origem.' : null,
                            ),
                            const SizedBox(height: 16),
                            DropdownButtonFormField<String>(
                              key: ValueKey(_sourceId),
                              initialValue: _destinationId,
                              decoration: const InputDecoration(
                                labelText: 'Conta de destino',
                              ),
                              items: items
                                  .where(
                                    (a) =>
                                        a.id != _sourceId &&
                                        (_sourceId == null ||
                                            a.currency ==
                                                items
                                                    .singleWhere(
                                                      (s) => s.id == _sourceId,
                                                    )
                                                    .currency),
                                  )
                                  .map(
                                    (a) => DropdownMenuItem(
                                      value: a.id,
                                      child: Text('${a.name} (${a.currency})'),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (value) =>
                                  setState(() => _destinationId = value),
                              validator: (value) => value == null
                                  ? 'Selecione outra conta na mesma moeda.'
                                  : null,
                            ),
                            const SizedBox(height: 16),
                            TextFormField(
                              controller: _description,
                              maxLength: 500,
                              decoration: const InputDecoration(
                                labelText: 'Descrição (opcional)',
                              ),
                            ),
                            if (_error case final message?)
                              Text(
                                message,
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.error,
                                ),
                              ),
                            FilledButton.icon(
                              onPressed: _saving ? null : () => _submit(items),
                              icon: const Icon(Icons.swap_horiz),
                              label: Text(
                                _saving
                                    ? 'Transferindo…'
                                    : 'Confirmar transferência',
                              ),
                            ),
                          ],
                        ),
                      ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
