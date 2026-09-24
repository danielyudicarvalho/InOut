import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:inout/src/application/financial/ledger_repository.dart';
import 'package:inout/src/core/types/ledger_transaction_kind.dart';
import 'package:inout/src/core/utils/money_utils.dart';
import 'package:inout/src/core/utils/uuid_utils.dart';
import 'package:inout/src/domain/household/household.dart';
import 'package:inout/src/infrastructure/financial/api_ledger_repository.dart';
import 'package:inout/src/presentation/providers/session_providers.dart';

final class LedgerHistoryScreen extends ConsumerStatefulWidget {
  const LedgerHistoryScreen({required this.household, super.key});

  final Household household;

  @override
  ConsumerState<LedgerHistoryScreen> createState() =>
      _LedgerHistoryScreenState();
}

final class _LedgerHistoryScreenState
    extends ConsumerState<LedgerHistoryScreen> {
  String? _accountId;
  String? _categoryId;
  LedgerTransactionKind? _kind;
  DateTime? _from;
  DateTime? _to;
  late Future<List<LedgerHistoryItem>> _history;
  final Map<String, String> _reversalKeys = {};
  String? _reversalError;
  bool _reversing = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _history = ref
        .read(ledgerRepositoryProvider)
        .getHistory(
          widget.household.id,
          accountId: _accountId,
          categoryId: _categoryId,
          kind: _kind?.name,
          from: _from,
          to: _to,
        );
  }

  Future<void> _reverse(LedgerHistoryItem item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Estornar lançamento?'),
        content: const Text(
          'O lançamento original ficará no histórico. Depois do estorno, '
          'registre um novo lançamento com os dados corretos.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Confirmar estorno'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() {
      _reversing = true;
      _reversalError = null;
    });
    try {
      await ref
          .read(ledgerRepositoryProvider)
          .reverse(
            householdId: widget.household.id,
            transactionId: item.transactionId,
            occurredOn: DateTime.now(),
            idempotencyKey: _reversalKeys.putIfAbsent(
              item.transactionId,
              UuidUtils.v4,
            ),
          );
      _reversalKeys.remove(item.transactionId);
      ref.invalidate(ledgerAccountsProvider(widget.household.id));
      ref.invalidate(financialDashboardProvider);
      if (mounted) setState(_load);
    } on ApiLedgerException catch (error) {
      if (mounted)
        setState(
          () => _reversalError = error.code == 'network_unavailable'
              ? 'Sem conexão. O estorno não foi confirmado; tente novamente.'
              : 'Não foi possível estornar este lançamento. Atualize o histórico.',
        );
    } catch (_) {
      if (mounted)
        setState(
          () => _reversalError = 'Não foi possível estornar. Tente novamente.',
        );
    } finally {
      if (mounted) setState(() => _reversing = false);
    }
  }

  Future<void> _chooseDate({required bool start}) async {
    final selected = await showDatePicker(
      context: context,
      initialDate: start ? (_from ?? DateTime.now()) : (_to ?? DateTime.now()),
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (selected != null && mounted) {
      setState(() {
        if (start) {
          _from = selected;
        } else {
          _to = selected;
        }
        _load();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final accounts = ref.watch(ledgerAccountsProvider(widget.household.id));
    final categories = ref.watch(
      ledgerHistoryCategoriesProvider(widget.household.id),
    );
    return Scaffold(
      appBar: AppBar(title: const Text('Histórico')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Wrap(
              spacing: 12,
              runSpacing: 8,
              children: [
                DropdownButton<String?>(
                  value: _accountId,
                  hint: const Text('Conta'),
                  items: [
                    const DropdownMenuItem<String?>(
                      value: null,
                      child: Text('Todas as contas'),
                    ),
                    ...?accounts.value?.map(
                      (item) => DropdownMenuItem<String?>(
                        value: item.id,
                        child: Text(item.name),
                      ),
                    ),
                  ],
                  onChanged: (value) => setState(() {
                    _accountId = value;
                    _load();
                  }),
                ),
                DropdownButton<String?>(
                  value: _categoryId,
                  hint: const Text('Categoria'),
                  items: [
                    const DropdownMenuItem<String?>(
                      value: null,
                      child: Text('Todas as categorias'),
                    ),
                    ...?categories.value?.map(
                      (item) => DropdownMenuItem<String?>(
                        value: item.id,
                        child: Text(item.name),
                      ),
                    ),
                  ],
                  onChanged: (value) => setState(() {
                    _categoryId = value;
                    _load();
                  }),
                ),
                DropdownButton<LedgerTransactionKind?>(
                  value: _kind,
                  hint: const Text('Tipo'),
                  items: [
                    const DropdownMenuItem<LedgerTransactionKind?>(
                      value: null,
                      child: Text('Todos os tipos'),
                    ),
                    ...LedgerTransactionKind.values.map(
                      (item) => DropdownMenuItem<LedgerTransactionKind?>(
                        value: item,
                        child: Text(item.name),
                      ),
                    ),
                  ],
                  onChanged: (value) => setState(() {
                    _kind = value;
                    _load();
                  }),
                ),
                OutlinedButton(
                  onPressed: () => _chooseDate(start: true),
                  child: Text(
                    _from == null
                        ? 'Desde'
                        : 'Desde ${_from!.day}/${_from!.month}/${_from!.year}',
                  ),
                ),
                OutlinedButton(
                  onPressed: () => _chooseDate(start: false),
                  child: Text(
                    _to == null
                        ? 'Até'
                        : 'Até ${_to!.day}/${_to!.month}/${_to!.year}',
                  ),
                ),
                TextButton(
                  onPressed: () => setState(() {
                    _from = null;
                    _to = null;
                    _accountId = null;
                    _categoryId = null;
                    _kind = null;
                    _load();
                  }),
                  child: const Text('Limpar filtros'),
                ),
              ],
            ),
          ),
          if (_reversalError case final error?)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                error,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          Expanded(
            child: FutureBuilder<List<LedgerHistoryItem>>(
              future: _history,
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return const Center(
                    child: Text('Não foi possível consultar o histórico.'),
                  );
                }
                if (!snapshot.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.data!.isEmpty) {
                  return const Center(
                    child: Text('Nenhum lançamento para estes filtros.'),
                  );
                }
                return ListView.builder(
                  itemCount: snapshot.data!.length,
                  itemBuilder: (context, index) {
                    final item = snapshot.data![index];
                    final firstEntry = snapshot.data!
                        .take(index)
                        .every(
                          (earlier) =>
                              earlier.transactionId != item.transactionId,
                        );
                    return ListTile(
                      title: Text(
                        item.description ?? item.categoryName ?? item.kind,
                      ),
                      subtitle: Text(
                        '${item.accountName} · ${item.categoryName ?? "Sem categoria"} · ${item.occurredOn.day}/${item.occurredOn.month}/${item.occurredOn.year}'
                        '${item.status == 'reversed' ? ' · Estornado' : ''}'
                        '${item.reversalOf != null ? ' · Estorno de ${item.reversalOf}' : ''}',
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            MoneyUtils.format(item.amountCents, item.currency),
                          ),
                          if (firstEntry &&
                              item.status == 'posted' &&
                              item.kind != 'reversal')
                            IconButton(
                              tooltip: 'Estornar lançamento',
                              onPressed: _reversing
                                  ? null
                                  : () => _reverse(item),
                              icon: const Icon(Icons.undo),
                            ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
