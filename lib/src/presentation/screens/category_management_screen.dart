import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:inout/src/application/financial/ledger_repository.dart';
import 'package:inout/src/core/utils/uuid_utils.dart';
import 'package:inout/src/domain/household/household.dart';
import 'package:inout/src/domain/transaction/financial_flow.dart';
import 'package:inout/src/infrastructure/financial/api_ledger_repository.dart';
import 'package:inout/src/presentation/providers/session_providers.dart';

final class CategoryManagementScreen extends ConsumerStatefulWidget {
  const CategoryManagementScreen({required this.household, super.key});

  final Household household;

  @override
  ConsumerState<CategoryManagementScreen> createState() =>
      _CategoryManagementScreenState();
}

final class _CategoryManagementScreenState
    extends ConsumerState<CategoryManagementScreen> {
  FinancialFlow _flow = FinancialFlow.expense;
  bool _includeArchived = false;

  Future<void> _create(List<CategorySummary> categories) async {
    final name = TextEditingController();
    String? parentId;
    final input = await showDialog<(String, String?)>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, refresh) => AlertDialog(
          title: const Text('Nova categoria'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: name,
                maxLength: 80,
                autofocus: true,
                decoration: const InputDecoration(labelText: 'Nome'),
              ),
              DropdownButtonFormField<String?>(
                initialValue: parentId,
                decoration: const InputDecoration(
                  labelText: 'Categoria principal',
                ),
                items: [
                  const DropdownMenuItem<String?>(
                    value: null,
                    child: Text('Nenhuma (categoria principal)'),
                  ),
                  ...categories
                      .where(
                        (category) =>
                            category.parentId == null &&
                            category.archivedAt == null,
                      )
                      .map(
                        (category) => DropdownMenuItem<String?>(
                          value: category.id,
                          child: Text(category.name),
                        ),
                      ),
                ],
                onChanged: (value) => refresh(() => parentId = value),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () {
                if (name.text.trim().isNotEmpty) {
                  Navigator.pop(dialogContext, (name.text.trim(), parentId));
                }
              },
              child: const Text('Criar'),
            ),
          ],
        ),
      ),
    );
    name.dispose();
    if (input == null || !mounted) return;
    try {
      await ref
          .read(ledgerRepositoryProvider)
          .createCategory(
            householdId: widget.household.id,
            id: UuidUtils.v4(),
            name: input.$1,
            flow: _flow.name,
            parentId: input.$2,
          );
      ref.invalidate(ledgerCategoriesProvider);
      ref.invalidate(ledgerAllCategoriesProvider);
    } on ApiLedgerException catch (error) {
      _showError(error.code);
    } catch (_) {
      _showError('Não foi possível criar a categoria.');
    }
  }

  Future<void> _archive(CategorySummary category) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Arquivar categoria?'),
        content: Text('O histórico de ${category.name} será preservado.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Arquivar'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await ref
          .read(ledgerRepositoryProvider)
          .archiveCategory(
            householdId: widget.household.id,
            categoryId: category.id,
          );
      ref.invalidate(ledgerCategoriesProvider);
      ref.invalidate(ledgerAllCategoriesProvider);
    } on ApiLedgerException catch (error) {
      _showError(
        error.code == 'category_has_active_children'
            ? 'Arquive as subcategorias antes da categoria principal.'
            : error.code,
      );
    } catch (_) {
      _showError('Não foi possível arquivar a categoria.');
    }
  }

  void _showError(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(
      ledgerAllCategoriesProvider((
        householdId: widget.household.id,
        flow: _flow.name,
      )),
    );
    return Scaffold(
      appBar: AppBar(title: const Text('Categorias')),
      body: Column(
        children: [
          SegmentedButton<FinancialFlow>(
            segments: const [
              ButtonSegment(
                value: FinancialFlow.income,
                label: Text('Entradas'),
              ),
              ButtonSegment(
                value: FinancialFlow.expense,
                label: Text('Saídas'),
              ),
            ],
            selected: {_flow},
            onSelectionChanged: (values) =>
                setState(() => _flow = values.first),
          ),
          SwitchListTile(
            title: const Text('Mostrar arquivadas'),
            value: _includeArchived,
            onChanged: (value) => setState(() => _includeArchived = value),
          ),
          Expanded(
            child: categories.when(
              data: (items) {
                final visible = _includeArchived
                    ? items
                    : items.where((item) => item.archivedAt == null).toList();
                return ListView(
                  children: visible.map((item) {
                    final parent = item.parentId == null
                        ? null
                        : items
                              .where((other) => other.id == item.parentId)
                              .firstOrNull;
                    return ListTile(
                      title: Text(item.name),
                      subtitle: Text(parent?.name ?? 'Categoria principal'),
                      trailing: item.archivedAt == null
                          ? IconButton(
                              tooltip: 'Arquivar ${item.name}',
                              icon: const Icon(Icons.archive_outlined),
                              onPressed: () => _archive(item),
                            )
                          : const Text('Arquivada'),
                    );
                  }).toList(),
                );
              },
              error: (_, _) =>
                  const Center(child: Text('Falha ao carregar categorias.')),
              loading: () => const Center(child: CircularProgressIndicator()),
            ),
          ),
        ],
      ),
      floatingActionButton: categories.hasValue
          ? FloatingActionButton.extended(
              onPressed: () => _create(categories.value!),
              icon: const Icon(Icons.add),
              label: const Text('Categoria'),
            )
          : null,
    );
  }
}
