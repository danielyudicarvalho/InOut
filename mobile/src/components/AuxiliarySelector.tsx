import { useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  ScrollView,
  StyleSheet,
} from "react-native";
import {
  selectorSearch,
  calendarDays,
  calendarMonth,
  displayDate,
  periodLabel,
  type AuxiliaryKind,
} from "@inout/finance";
import { useAuxiliary } from "../finance/use-auxiliary";
import { theme as t } from "../theme";
export type SelectOption = {
  id: string;
  name: string;
  detail?: string;
  disabled?: boolean;
};
export type CreateOptionContext = {
  household: string;
  kind: AuxiliaryKind;
  flow: string;
  parentId: string;
  currency: string;
  fixedCurrency?: boolean;
  onCreated: (id: string) => void;
};
export function AuxiliarySelector({
  title,
  value,
  items,
  onChange,
  disabled = false,
  create,
  context,
}: {
  title: string;
  value: string;
  items: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  create?: CreateOptionContext;
  context?: string;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [creating, setCreating] = useState(false);
  const matches = selectorSearch(items, query);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${items.find((i) => i.id === value)?.name ?? "Selecione"}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        style={s.trigger}
        onPress={() => {
          setQuery("");
          setCreating(false);
          setOpen(true);
        }}
      >
        <Text style={s.text}>
          {items.find((i) => i.id === value)?.name ?? "Selecione"} ▾
        </Text>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={s.overlay}>
          <View style={s.sheet} accessibilityViewIsModal>
            <View style={s.header}>
              <Text style={s.title}>{creating ? "Criar item" : title}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar seleção"
                style={s.close}
                onPress={() => setOpen(false)}
              >
                <Text>×</Text>
              </Pressable>
            </View>
            {creating && create ? (
              <CreateOption {...create} />
            ) : (
              <>
                {context && <Text style={s.context}>{context}</Text>}
                <TextInput
                  autoFocus
                  accessibilityLabel={`Buscar em ${title}`}
                  style={s.input}
                  placeholder="Buscar…"
                  value={query}
                  onChangeText={setQuery}
                />
                <ScrollView keyboardShouldPersistTaps="handled" style={s.list}>
                  {matches.map((item) => (
                    <Pressable
                      key={item.id}
                      disabled={item.disabled}
                      accessibilityRole="radio"
                      accessibilityState={{
                        checked: value === item.id,
                        disabled: item.disabled,
                      }}
                      style={[
                        s.option,
                        value === item.id && s.selected,
                        item.disabled && { opacity: 0.5 },
                      ]}
                      onPress={() => {
                        onChange(item.id);
                        setOpen(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.text}>{item.name}</Text>
                        {item.detail && (
                          <Text style={s.detail}>{item.detail}</Text>
                        )}
                      </View>
                      {value === item.id && <Text>✓</Text>}
                    </Pressable>
                  ))}
                  {!matches.length && (
                    <Text accessibilityLiveRegion="polite">
                      Nenhum resultado encontrado.
                    </Text>
                  )}
                </ScrollView>
                {create && (
                  <Pressable
                    style={s.option}
                    accessibilityRole="button"
                    onPress={() => setCreating(true)}
                  >
                    <Text style={s.text}>
                      ＋{" "}
                      {create.kind === "account"
                        ? "Criar conta"
                        : create.kind === "source"
                          ? "Criar fonte"
                          : create.parentId
                            ? "Criar subcategoria"
                            : "Criar categoria"}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
function CreateOption(props: CreateOptionContext) {
  const state = useAuxiliary(
      props.household,
      props.kind,
      props.flow,
      props.parentId,
      props.currency,
    ),
    locked = state.status !== "ready";
  if (state.status === "success" && state.result)
    return (
      <View style={s.form}>
        <Text accessibilityLiveRegion="polite">Item criado com sucesso.</Text>
        <Pressable
          style={s.option}
          onPress={() => props.onCreated(state.result!.id)}
        >
          <Text>Usar item criado</Text>
        </Pressable>
      </View>
    );
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.form}
    >
      <Text>O item será salvo nesta residência.</Text>
      {state.notice && <Text accessibilityRole="alert">{state.notice}</Text>}
      {state.status === "loading" ? (
        <Text>Carregando…</Text>
      ) : state.status === "error" ? (
        <Pressable style={s.option} onPress={state.retry}>
          <Text>Tentar novamente</Text>
        </Pressable>
      ) : (
        <>
          <Text style={s.text}>Nome</Text>
          <TextInput
            autoFocus
            accessibilityLabel="Nome do novo item"
            editable={!locked}
            maxLength={80}
            style={s.input}
            value={state.fields.name}
            onChangeText={(v) => state.edit("name", v)}
          />
          {props.kind === "account" && (
            <>
              <Text>Moeda</Text>
              <TextInput
                accessibilityLabel="Moeda da nova conta"
                editable={!locked && !props.fixedCurrency}
                maxLength={3}
                autoCapitalize="characters"
                style={s.input}
                value={state.fields.currency}
                onChangeText={(v) => state.edit("currency", v.toUpperCase())}
              />
              <Text>Tipo</Text>
              <View style={s.types}>
                {[
                  ["checking", "Conta corrente"],
                  ["cash", "Dinheiro"],
                  ["savings", "Poupança"],
                  ["investment", "Investimento"],
                  ["other", "Outra"],
                ].map(([v, n]) => (
                  <Pressable
                    disabled={locked}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: state.fields.accountKind === v,
                    }}
                    style={[
                      s.option,
                      state.fields.accountKind === v && s.selected,
                    ]}
                    key={v}
                    onPress={() => state.edit("accountKind", v)}
                  >
                    <Text>{n}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={s.detail}>
                A conta será criada com saldo inicial zero.
              </Text>
            </>
          )}
          <Pressable
            style={[s.option, s.selected]}
            disabled={state.status === "saving"}
            onPress={() => void state.submit()}
          >
            <Text>
              {state.status === "saving"
                ? "Salvando…"
                : state.status === "uncertain"
                  ? "Verificar tentativa pendente"
                  : "Criar"}
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function DateSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState(value || today()),
    [month, setMonth] = useState((value || today()).slice(0, 7));
  return (
    <>
      <Pressable
        style={s.trigger}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Selecionar data: ${displayDate(value)}`}
        onPress={() => {
          setSelected(value || today());
          setMonth((value || today()).slice(0, 7));
          setOpen(true);
        }}
      >
        <Text style={s.text}>{displayDate(value)} ▦</Text>
      </Pressable>
      <Modal
        transparent
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={s.overlay}>
          <View style={s.sheet} accessibilityViewIsModal>
            <View style={s.header}>
              <Text style={s.title}>Selecionar data</Text>
              <Pressable
                style={s.close}
                accessibilityLabel="Fechar calendário"
                onPress={() => setOpen(false)}
              >
                <Text>×</Text>
              </Pressable>
            </View>
            <View style={s.header}>
              <Pressable
                style={s.close}
                accessibilityLabel="Mês anterior"
                disabled={month === "2000-01"}
                onPress={() => setMonth(calendarMonth(month, -1))}
              >
                <Text>‹</Text>
              </Pressable>
              <Text style={s.text}>{periodLabel(month)}</Text>
              <Pressable
                style={s.close}
                accessibilityLabel="Próximo mês"
                disabled={month === "9998-12"}
                onPress={() => setMonth(calendarMonth(month, 1))}
              >
                <Text>›</Text>
              </Pressable>
            </View>
            <View style={s.calendar}>
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
                <View key={day} style={s.day}>
                  <Text style={s.detail}>{day}</Text>
                </View>
              ))}
              {calendarDays(month).map((date, i) =>
                date ? (
                  <Pressable
                    key={date}
                    style={[s.day, date === selected && s.selected]}
                    accessibilityRole="button"
                    accessibilityLabel={displayDate(date)}
                    accessibilityState={{ selected: date === selected }}
                    onPress={() => setSelected(date)}
                  >
                    <Text>{Number(date.slice(8))}</Text>
                  </Pressable>
                ) : (
                  <View key={i} style={s.day} />
                ),
              )}
            </View>
            <View style={s.header}>
              <Pressable
                style={s.option}
                onPress={() => {
                  setSelected(today());
                  setMonth(today().slice(0, 7));
                }}
              >
                <Text>Hoje</Text>
              </Pressable>
              <Pressable
                style={[s.option, s.selected]}
                onPress={() => {
                  onChange(selected);
                  setOpen(false);
                }}
              >
                <Text>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
const s = StyleSheet.create({
  trigger: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#fffdf8",
  },
  text: { fontFamily: t.sans, color: "#234a35", fontSize: 14 },
  overlay: {
    flex: 1,
    backgroundColor: "#14231e66",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: t.cream,
    maxHeight: "85%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontFamily: t.serif, fontSize: 20, color: "#214b36", flexShrink: 1 },
  close: {
    padding: 12,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 9,
    padding: 12,
    backgroundColor: "#fffdf8",
  },
  list: { maxHeight: 360 },
  option: {
    padding: 13,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
  },
  selected: { backgroundColor: "#dce7d5", borderRadius: 12 },
  detail: { fontSize: 11, color: t.muted },
  context: {
    padding: 10,
    backgroundColor: "#eee9da",
    borderRadius: 8,
    color: t.ink,
  },
  form: { gap: 12, paddingBottom: 20 },
  types: { flexDirection: "row", flexWrap: "wrap" },
  calendar: { flexDirection: "row", flexWrap: "wrap" },
  day: {
    width: "14.2857%",
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
