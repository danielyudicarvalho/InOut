import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:inout/src/domain/household/household.dart';
import 'package:inout/src/domain/transaction/financial_flow.dart';
import 'package:inout/src/infrastructure/financial/api_ledger_repository.dart';
import 'package:inout/src/presentation/providers/session_providers.dart';

final class TransactionFormScreen extends ConsumerStatefulWidget {
  const TransactionFormScreen({
    required this.household,
    required this.flow,
    super.key,
  });

  final Household household;
  final FinancialFlow flow;

  @override
  ConsumerState<TransactionFormScreen> createState() =>
      _TransactionFormScreenState();
}

final class _TransactionFormScreenState
    extends ConsumerState<TransactionFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amount = TextEditingController();
  final _description = TextEditingController();
  String? _accountId;
  String? _categoryId;
  bool _saving = false;
  String? _error;

  bool get _isIncome => widget.flow == FinancialFlow.income;
  String get _flow => _isIncome ? 'income' : 'expense';

  @override
  void dispose() {
    _amount.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    final repository = ref.read(ledgerRepositoryProvider);
    final cents = _parseAmount(_amount.text)!;
    final arguments = (
      householdId: widget.household.id,
      accountId: _accountId!,
      categoryId: _categoryId!,
      amountCents: cents,
      currency: 'BRL',
      occurredOn: DateTime.now(),
      idempotencyKey: _uuidV4(),
      description: _description.text.trim().isEmpty
          ? null
          : _description.text.trim(),
    );
    try {
      if (_isIncome) {
        await repository.postIncome(
          householdId: arguments.householdId,
          accountId: arguments.accountId,
          categoryId: arguments.categoryId,
          amountCents: arguments.amountCents,
          currency: arguments.currency,
          occurredOn: arguments.occurredOn,
          idempotencyKey: arguments.idempotencyKey,
          description: arguments.description,
        );
      } else {
        await repository.postExpense(
          householdId: arguments.householdId,
          accountId: arguments.accountId,
          categoryId: arguments.categoryId,
          amountCents: arguments.amountCents,
          currency: arguments.currency,
          occurredOn: arguments.occurredOn,
          idempotencyKey: arguments.idempotencyKey,
          description: arguments.description,
        );
      }
      ref.invalidate(ledgerAccountsProvider(widget.household.id));
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } on ApiLedgerException catch (error) {
      if (mounted) {
        setState(() => _error = _messageFor(error.code));
      }
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Não foi possível salvar. Tente novamente.');
      }
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final accounts = ref.watch(ledgerAccountsProvider(widget.household.id));
    final categories = ref.watch(
      ledgerCategoriesProvider((householdId: widget.household.id, flow: _flow)),
    );
    final ready = accounts.hasValue && categories.hasValue;
    return Scaffold(
      appBar: AppBar(title: Text(_isIncome ? 'Nova entrada' : 'Nova saída')),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: accounts.hasError || categories.hasError
                  ? const Center(
                      child: Text(
                        'Não foi possível carregar contas e categorias.',
                      ),
                    )
                  : !ready
                  ? const Center(child: CircularProgressIndicator())
                  : accounts.value!.isEmpty || categories.value!.isEmpty
                  ? const Center(
                      child: Text(
                        'É necessário ter uma conta e uma categoria ativa para lançar.',
                      ),
                    )
                  : Form(
                      key: _formKey,
                      child: ListView(
                        children: [
                          TextFormField(
                            controller: _amount,
                            autofocus: true,
                            keyboardType: const TextInputType.numberWithOptions(
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
                              helperText: 'Ex.: 12,50',
                            ),
                            validator: (value) =>
                                (_parseAmount(value ?? '') ?? 0) <= 0
                                ? 'Informe um valor maior que zero.'
                                : null,
                          ),
                          const SizedBox(height: 16),
                          DropdownButtonFormField<String>(
                            initialValue: _accountId,
                            decoration: const InputDecoration(
                              labelText: 'Conta',
                            ),
                            items: accounts.value!
                                .map(
                                  (item) => DropdownMenuItem(
                                    value: item.id,
                                    child: Text(item.name),
                                  ),
                                )
                                .toList(),
                            onChanged: (value) =>
                                setState(() => _accountId = value),
                            validator: (value) =>
                                value == null ? 'Selecione uma conta.' : null,
                          ),
                          const SizedBox(height: 16),
                          DropdownButtonFormField<String>(
                            initialValue: _categoryId,
                            decoration: const InputDecoration(
                              labelText: 'Categoria',
                            ),
                            items: categories.value!
                                .map(
                                  (item) => DropdownMenuItem(
                                    value: item.id,
                                    child: Text(item.name),
                                  ),
                                )
                                .toList(),
                            onChanged: (value) =>
                                setState(() => _categoryId = value),
                            validator: (value) => value == null
                                ? 'Selecione uma categoria.'
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
                              _saving ? 'Salvando…' : 'Salvar lançamento',
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

  static String _messageFor(String code) => switch (code) {
    'invalid_account' => 'A conta não pertence a esta residência.',
    'invalid_category' =>
      'A categoria não pertence à residência ou ao tipo do lançamento.',
    'invalid_amount' => 'Informe um valor maior que zero.',
    _ => 'Não foi possível salvar. Verifique os dados e tente novamente.',
  };

  static String _uuidV4() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes
        .map((value) => value.toRadixString(16).padLeft(2, '0'))
        .join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-'
        '${hex.substring(16, 20)}-${hex.substring(20)}';
  }

  static int? _parseAmount(String value) {
    final normalized = value.trim().replaceAll('.', '').replaceAll(',', '.');
    final amount = double.tryParse(normalized);
    if (amount == null || !amount.isFinite) return null;
    return (amount * 100).round();
  }
}
