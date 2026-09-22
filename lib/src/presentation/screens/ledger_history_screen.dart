import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:inout/src/application/financial/ledger_repository.dart';
import 'package:inout/src/core/types/ledger_transaction_kind.dart';
import 'package:inout/src/core/utils/money_utils.dart';
import 'package:inout/src/domain/household/household.dart';
import 'package:inout/src/presentation/providers/session_providers.dart';

final class LedgerHistoryScreen extends ConsumerStatefulWidget {
  const LedgerHistoryScreen({required this.household, super.key});

  final Household household;

  @override
  ConsumerState<LedgerHistoryScreen> createState() => _LedgerHistoryScreenState();
}

final class _LedgerHistoryScreenState extends ConsumerState<LedgerHistoryScreen> {
  String? _accountId;
  String? _categoryId;
  LedgerTransactionKind? _kind;
  DateTime? _from;
  DateTime? _to;
  late Future<List<LedgerHistoryItem>> _history;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _history = ref.read(ledgerRepositoryProvider).getHistory(
      widget.household.id,
      accountId: _accountId,
      categoryId: _categoryId,
      kind: _kind?.name,
      from: _from,
      to: _to,
    );
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
    final categories = ref.watch(ledgerHistoryCategoriesProvider(widget.household.id));
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
                    const DropdownMenuItem<String?>(value: null, child: Text('Todas as contas')),
                    ...?accounts.value?.map((item) => DropdownMenuItem<String?>(
                          value: item.id,
                          child: Text(item.name),
                        )),
                  ],
                  onChanged: (value) => setState(() { _accountId = value; _load(); }),
                ),
                DropdownButton<String?>(
                  value: _categoryId,
                  hint: const Text('Categoria'),
                  items: [
                    const DropdownMenuItem<String?>(value: null, child: Text('Todas as categorias')),
                    ...?categories.value?.map((item) => DropdownMenuItem<String?>(
                          value: item.id,
                          child: Text(item.name),
                        )),
                  ],
                  onChanged: (value) => setState(() { _categoryId = value; _load(); }),
                ),
                DropdownButton<LedgerTransactionKind?>(
                  value: _kind,
                  hint: const Text('Tipo'),
                  items: [
                    const DropdownMenuItem<LedgerTransactionKind?>(value: null, child: Text('Todos os tipos')),
                    ...LedgerTransactionKind.values.map((item) => DropdownMenuItem<LedgerTransactionKind?>(
                          value: item,
                          child: Text(item.name),
                        )),
                  ],
                  onChanged: (value) => setState(() { _kind = value; _load(); }),
                ),
                OutlinedButton(
                  onPressed: () => _chooseDate(start: true),
                  child: Text(_from == null ? 'Desde' : 'Desde ${_from!.day}/${_from!.month}/${_from!.year}'),
                ),
                OutlinedButton(
                  onPressed: () => _chooseDate(start: false),
                  child: Text(_to == null ? 'Até' : 'Até ${_to!.day}/${_to!.month}/${_to!.year}'),
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
          Expanded(
            child: FutureBuilder<List<LedgerHistoryItem>>(
              future: _history,
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return const Center(child: Text('Não foi possível consultar o histórico.'));
                }
                if (!snapshot.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.data!.isEmpty) {
                  return const Center(child: Text('Nenhum lançamento para estes filtros.'));
                }
                return ListView.builder(
                  itemCount: snapshot.data!.length,
                  itemBuilder: (context, index) {
                    final item = snapshot.data![index];
                    return ListTile(
                      title: Text(item.description ?? item.categoryName ?? item.kind),
                      subtitle: Text('${item.accountName} · ${item.categoryName ?? "Sem categoria"} · ${item.occurredOn.day}/${item.occurredOn.month}/${item.occurredOn.year}'),
                      trailing: Text(MoneyUtils.formatBrl(item.amountCents)),
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
