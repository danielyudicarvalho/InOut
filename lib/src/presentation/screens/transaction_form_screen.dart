import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:inout/src/core/types/currency_codes.dart';
import 'package:inout/src/core/utils/money_utils.dart';
import 'package:inout/src/core/utils/string_utils.dart';
import 'package:inout/src/core/utils/uuid_utils.dart';
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
  String? _pendingIntentSignature;
  String? _pendingIdempotencyKey;

  bool get _isIncome => widget.flow == FinancialFlow.income;
  String get _flow => widget.flow.name;

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
    final cents = MoneyUtils.parseBrlToCents(_amount.text)!;
    final occurredOn = DateTime.now();
    final description = StringUtils.trimToNull(_description.text);
    final intentSignature = [
      widget.household.id,
      widget.flow.name,
      _accountId,
      _categoryId,
      cents,
      occurredOn.toIso8601String().substring(0, 10),
      description,
    ].join('|');
    if (_pendingIntentSignature != intentSignature) {
      _pendingIntentSignature = intentSignature;
      _pendingIdempotencyKey = UuidUtils.v4();
    }
    final arguments = (
      householdId: widget.household.id,
      accountId: _accountId!,
      categoryId: _categoryId!,
      amountCents: cents,
      currency: CurrencyCodes.brl,
      occurredOn: occurredOn,
      idempotencyKey: _pendingIdempotencyKey!,
      description: description,
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
                                (MoneyUtils.parseBrlToCents(value ?? '') ??
                                        0) <=
                                    0
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
                            items: categories.value!.map((item) {
                              final parent = item.parentId == null
                                  ? null
                                  : categories.value!
                                        .where((candidate) => candidate.id == item.parentId)
                                        .firstOrNull;
                              return DropdownMenuItem(
                                value: item.id,
                                child: Text(parent == null ? item.name : '${parent.name} › ${item.name}'),
                              );
                            }).toList(),
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
    'network_unavailable' =>
      'Sem conexão. O lançamento não foi confirmado; tente novamente quando '
          'a conexão voltar.',
    _ => 'Não foi possível salvar. Verifique os dados e tente novamente.',
  };
}
