import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  Image,
  StyleSheet,
} from "react-native";
import {
  historyDraft,
  applyHistoryDraft,
  parsePeriod,
  inputDate,
  displayDate,
  financeMessage,
  type HistoryFilters,
  type HistoryOptions,
} from "@inout/finance";
import { useHistoryOptions } from "../finance/use-history-options";
import { theme as t } from "../theme";
export function HistoryFiltersPanel({
  household,
  period,
  filters,
  onApply,
  onClose,
}: {
  household: string;
  period: string;
  filters: HistoryFilters;
  onApply: (period: string, filters: HistoryFilters) => void;
  onClose: () => void;
}) {
  const options = useHistoryOptions(household);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar filtros"
            style={s.close}
            onPress={onClose}
          >
            <Text>× Fechar</Text>
          </Pressable>
          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
          >
            <Image
              source={require("../../assets/pipo-filters.webp")}
              style={s.art}
            />
            <Text accessibilityRole="header" style={s.title}>
              Busca e filtros
            </Text>
            <Text>Encontre as movimentações do seu lar.</Text>
            {options.data ? (
              <FilterForm
                catalog={options.data}
                period={period}
                filters={filters}
                onApply={onApply}
              />
            ) : (
              <View>
                <Text accessibilityLiveRegion="polite">
                  {options.error || "Carregando contas e categorias…"}
                </Text>
                {options.error && (
                  <Pressable style={s.button} onPress={options.retry}>
                    <Text>Tentar novamente</Text>
                  </Pressable>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
function Choice({
  label,
  value,
  items,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  items: { id: string; name: string }[];
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${items.find((i) => i.id === value)?.name ?? "Todas"}`}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        style={[s.button, disabled && { opacity: 0.5 }]}
        onPress={() => setOpen(!open)}
      >
        <Text>{items.find((i) => i.id === value)?.name ?? "Todas"} ▾</Text>
      </Pressable>
      {open &&
        !disabled &&
        items.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: item.id === value }}
            style={s.option}
            onPress={() => {
              onChange(item.id);
              setOpen(false);
            }}
          >
            <Text>
              {item.id === value ? "✓ " : ""}
              {item.name}
            </Text>
          </Pressable>
        ))}
    </View>
  );
}
function FilterForm({
  catalog,
  period,
  filters,
  onApply,
}: {
  catalog: HistoryOptions;
  period: string;
  filters: HistoryFilters;
  onApply: (period: string, filters: HistoryFilters) => void;
}) {
  const [draft, setDraft] = useState(() =>
      historyDraft(period, filters, catalog),
    ),
    [error, setError] = useState(""),
    [from, setFrom] = useState(() => displayDate(parsePeriod(period).from)),
    [to, setTo] = useState(() => displayDate(parsePeriod(period).to));
  const select = (key: string, value: string) =>
    setDraft({ ...draft, [key]: value });
  const categories = catalog.categories.filter(
    (c) =>
      !c.parentId &&
      (!["income", "expense"].includes(draft.kind ?? "") ||
        c.flow === draft.kind),
  );
  const badges = [
    draft.kind && {
      label: (
        {
          income: "Entrada",
          expense: "Saída",
          transfer: "Transferência",
          reversal: "Estorno",
          openingbalance: "Saldo inicial",
        } as Record<string, string>
      )[draft.kind],
      remove: () => setDraft({ ...draft, kind: "", incomeSourceId: "" }),
    },
    draft.accountId && {
      label:
        catalog.accounts.find((a) => a.id === draft.accountId)?.name ?? "Conta",
      remove: () => select("accountId", ""),
    },
    draft.parentId && {
      label:
        catalog.categories.find((c) => c.id === draft.parentId)?.name ??
        "Categoria",
      remove: () => setDraft({ ...draft, parentId: "", subcategoryId: "" }),
    },
    draft.subcategoryId && {
      label:
        catalog.categories.find((c) => c.id === draft.subcategoryId)?.name ??
        "Subcategoria",
      remove: () => select("subcategoryId", ""),
    },
    draft.incomeSourceId && {
      label:
        catalog.sources.find((c) => c.id === draft.incomeSourceId)?.name ??
        "Fonte",
      remove: () => select("incomeSourceId", ""),
    },
  ].filter(Boolean) as { label: string; remove: () => void }[];
  return (
    <View style={s.form}>
      <Text style={s.label}>Buscar por texto</Text>
      <TextInput
        accessibilityLabel="Buscar por texto"
        style={s.input}
        value={draft.search ?? ""}
        maxLength={500}
        placeholder="Descrição do lançamento"
        onChangeText={(v) => select("search", v)}
      />
      <Text style={s.label}>Período</Text>
      <View style={s.dates}>
        <View style={{ flex: 1 }}>
          <Text>Data inicial</Text>
          <TextInput
            accessibilityLabel="Data inicial, dia mês ano"
            placeholder="DD/MM/AAAA"
            style={s.input}
            value={from}
            onChangeText={setFrom}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text>Data final</Text>
          <TextInput
            accessibilityLabel="Data final, dia mês ano"
            placeholder="DD/MM/AAAA"
            style={s.input}
            value={to}
            onChangeText={setTo}
          />
        </View>
      </View>
      <Text style={s.label}>Tipo</Text>
      <View style={s.chips}>
        {[
          ["", "Todos"],
          ["income", "Entrada"],
          ["expense", "Saída"],
          ["transfer", "Transferência"],
          ["reversal", "Estorno"],
          ["openingbalance", "Saldo inicial"],
        ].map(([v, l]) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: (draft.kind ?? "") === v }}
            key={v}
            style={[s.chip, (draft.kind ?? "") === v && s.selected]}
            onPress={() =>
              setDraft({
                ...draft,
                kind: v,
                parentId: "",
                subcategoryId: "",
                incomeSourceId: v === "income" ? draft.incomeSourceId : "",
              })
            }
          >
            <Text
              style={(draft.kind ?? "") === v ? { color: "white" } : undefined}
            >
              {l}
            </Text>
          </Pressable>
        ))}
      </View>
      <Choice
        label="Conta"
        value={draft.accountId ?? ""}
        items={[
          { id: "", name: "Todas as contas" },
          ...catalog.accounts.map((a) => ({
            ...a,
            name: `${a.name} · ${a.currency}`,
          })),
        ]}
        onChange={(v) => select("accountId", v)}
      />
      <Choice
        label="Categoria"
        value={draft.parentId}
        items={[{ id: "", name: "Todas as categorias" }, ...categories]}
        onChange={(v) => setDraft({ ...draft, parentId: v, subcategoryId: "" })}
      />
      <Choice
        label="Subcategoria"
        value={draft.subcategoryId}
        disabled={!draft.parentId}
        items={[
          { id: "", name: "Todas da categoria" },
          ...catalog.categories.filter((c) => c.parentId === draft.parentId),
        ]}
        onChange={(v) => select("subcategoryId", v)}
      />
      <Choice
        label="Fonte de renda"
        disabled={draft.kind !== "income"}
        value={draft.incomeSourceId ?? ""}
        items={[
          {
            id: "",
            name:
              draft.kind === "income"
                ? "Todas as fontes"
                : "Disponível para entradas",
          },
          ...catalog.sources,
        ]}
        onChange={(v) => select("incomeSourceId", v)}
      />
      {draft.kind !== "income" && (
        <Text style={s.help}>
          Selecione Entrada para filtrar por fonte de renda.
        </Text>
      )}
      <Text style={s.label}>Filtros selecionados</Text>
      <View style={s.chips}>
        {badges.map((b, i) => (
          <Pressable
            key={i}
            accessibilityLabel={`Remover ${b.label}`}
            style={s.chip}
            onPress={b.remove}
          >
            <Text>{b.label} ×</Text>
          </Pressable>
        ))}
        {!badges.length && <Text>Nenhum filtro adicional.</Text>}
      </View>
      {error && <Text accessibilityRole="alert">{error}</Text>}
      <View style={s.dates}>
        <Pressable
          style={[s.button, { flex: 1 }]}
          onPress={() => {
            const b = parsePeriod(period);
            setDraft({
              from: b.from,
              to: b.to,
              parentId: "",
              subcategoryId: "",
            });
            setFrom(displayDate(b.from));
            setTo(displayDate(b.to));
            setError("");
          }}
        >
          <Text>Limpar filtros</Text>
        </Pressable>
        <Pressable
          style={[s.button, s.apply]}
          onPress={() => {
            try {
              const next = applyHistoryDraft({
                ...draft,
                from: inputDate(from),
                to: inputDate(to),
              });
              onApply(next.period, next.filters);
            } catch (e) {
              setError(financeMessage(e));
            }
          }}
        >
          <Text style={{ color: "white" }}>Aplicar filtros</Text>
        </Pressable>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#24271e66",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "94%",
    backgroundColor: t.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  content: { padding: 20, gap: 10 },
  close: { alignSelf: "flex-end", padding: 12, marginRight: 12 },
  art: { width: "100%", height: 130, resizeMode: "contain" },
  title: { fontFamily: t.serif, fontSize: 27, color: "#214b36" },
  label: { fontFamily: t.sans, fontWeight: "700", color: "#214b36" },
  form: { gap: 12, paddingTop: 12 },
  field: { gap: 7 },
  input: {
    padding: 12,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 9,
    backgroundColor: "#fffdf6",
    color: t.ink,
  },
  button: {
    padding: 12,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 9,
    backgroundColor: "#fffdf6",
  },
  option: { padding: 12, borderBottomWidth: 1, borderColor: t.line },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: t.line,
    backgroundColor: "#f5efe0",
  },
  selected: { backgroundColor: "#bf4935" },
  dates: { flexDirection: "row", gap: 10 },
  apply: { backgroundColor: "#246e46", flex: 1 },
  help: { fontSize: 12, color: t.muted },
});
