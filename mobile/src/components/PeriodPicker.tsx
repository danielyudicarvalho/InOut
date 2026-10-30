import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  Keyboard,
} from "react-native";
import {
  calendarDays,
  parsePeriod,
  periodLabel,
  presetPeriod,
  rangePeriod,
  displayDate,
  inputDate,
  financeMessage,
} from "@inout/finance";
import { theme as t } from "../theme";
export function PeriodPicker({
  value,
  onApply,
  onClose,
}: {
  value: string;
  onApply: (value: string) => void;
  onClose: () => void;
}) {
  const bounds = parsePeriod(value);
  const [fromText, setFrom] = useState(displayDate(bounds.from)),
    [toText, setTo] = useState(displayDate(bounds.to));
  const from = inputDate(fromText),
    to = inputDate(toText);
  const [month, setMonth] = useState(bounds.from.slice(0, 7));
  const [preset, setPreset] = useState(() =>
      value === presetPeriod("current")
        ? "current"
        : value === presetPeriod("previous")
          ? "previous"
          : value === presetPeriod("quarter")
            ? "quarter"
            : "custom",
    ),
    [selection, setSelection] = useState(value);
  const [selectingEnd, setSelectingEnd] = useState(false),
    [error, setError] = useState("");
  function quick(kind: "current" | "previous" | "quarter") {
    Keyboard.dismiss();
    const next = presetPeriod(kind),
      b = parsePeriod(next);
    setFrom(displayDate(b.from));
    setTo(displayDate(b.to));
    setMonth(b.from.slice(0, 7));
    setPreset(kind);
    setSelection(next);
    setSelectingEnd(false);
    setError("");
  }
  function day(date: string) {
    Keyboard.dismiss();
    setPreset("custom");
    setError("");
    if (!selectingEnd || date < from) {
      setFrom(displayDate(date));
      setTo("");
      setSelectingEnd(true);
    } else {
      setTo(displayDate(date));
      setSelectingEnd(false);
    }
  }
  function move(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    if (d.getFullYear() < 2000 || d.getFullYear() > 9998) return;
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  function apply() {
    try {
      const period = rangePeriod(from, to);
      Keyboard.dismiss();
      onApply(preset === "custom" ? period : selection);
    } catch (e) {
      setError(financeMessage(e));
    }
  }
  let label = "Selecione o início e o fim do intervalo.";
  try {
    label = periodLabel(rangePeriod(from, to));
  } catch {}
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet} accessibilityViewIsModal>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.content}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar seleção de período"
              style={s.close}
              onPress={onClose}
            >
              <Text style={s.closeText}>×</Text>
            </Pressable>
            <View style={s.header}>
              <Image
                source={require("../../assets/pipo-period.webp")}
                style={s.art}
                resizeMode="contain"
                accessible={false}
              />
              <View style={s.headerCopy}>
                <Text accessibilityRole="header" style={s.title}>
                  Selecionar período
                </Text>
                <Text style={s.help}>
                  Escolha quando olhar para suas finanças.
                </Text>
              </View>
            </View>
            <View style={s.presets}>
              {[
                { id: "current", label: "Este mês" },
                { id: "previous", label: "Mês passado" },
                { id: "quarter", label: "Últimos 3 meses" },
                { id: "custom", label: "Personalizado" },
              ].map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: preset === item.id }}
                  style={[s.preset, preset === item.id && s.selected]}
                  onPress={() =>
                    item.id === "custom"
                      ? setPreset("custom")
                      : quick(item.id as "current" | "previous" | "quarter")
                  }
                >
                  <Text
                    style={[s.presetText, preset === item.id && s.selectedText]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={s.month}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mês anterior"
                style={s.arrow}
                onPress={() => move(-1)}
              >
                <Text style={s.arrowText}>‹</Text>
              </Pressable>
              <Text
                accessibilityRole="header"
                accessibilityLiveRegion="polite"
                style={s.monthTitle}
              >
                {periodLabel(month)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Próximo mês"
                style={s.arrow}
                onPress={() => move(1)}
              >
                <Text style={s.arrowText}>›</Text>
              </Pressable>
            </View>
            <View style={s.grid}>
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                <View key={d} style={s.cell}>
                  <Text style={s.weekday}>{d}</Text>
                </View>
              ))}
              {calendarDays(month).map((date, index) => (
                <View key={date ?? index} style={s.cell}>
                  {date ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={displayDate(date)}
                      accessibilityState={{
                        selected: date === from || date === to,
                      }}
                      style={[
                        s.day,
                        date > from && date < to && s.inRange,
                        (date === from || date === to) && s.endpoint,
                      ]}
                      onPress={() => day(date)}
                    >
                      <Text
                        style={[
                          s.dayText,
                          (date === from || date === to) && s.selectedText,
                        ]}
                      >
                        {Number(date.slice(8))}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
            <View style={s.fields}>
              <View style={s.field}>
                <Text style={s.help}>Data inicial</Text>
                <TextInput
                  accessibilityLabel="Data inicial, dia mês e ano"
                  value={fromText}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  keyboardType="numbers-and-punctuation"
                  style={s.input}
                  onChangeText={(v) => {
                    setFrom(v);
                    setPreset("custom");
                    setError("");
                    setSelectingEnd(false);
                  }}
                />
              </View>
              <View style={s.field}>
                <Text style={s.help}>Data final</Text>
                <TextInput
                  accessibilityLabel="Data final, dia mês e ano"
                  value={toText}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  keyboardType="numbers-and-punctuation"
                  style={s.input}
                  onChangeText={(v) => {
                    setTo(v);
                    setPreset("custom");
                    setError("");
                    setSelectingEnd(false);
                  }}
                />
              </View>
            </View>
            <Text style={s.help}>
              {selectingEnd
                ? "Agora selecione a data final."
                : "Selecione o início e o fim do intervalo."}
            </Text>
            <Text style={s.summary} accessibilityLiveRegion="polite">
              {label}
            </Text>
            {error ? (
              <Text accessibilityLiveRegion="assertive" style={s.error}>
                {error}
              </Text>
            ) : null}
            <View style={s.actions}>
              <Pressable
                accessibilityRole="button"
                style={s.cancel}
                onPress={onClose}
              >
                <Text style={s.dayText}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[s.cancel, s.selected]}
                onPress={apply}
              >
                <Text style={[s.dayText, s.selectedText]}>Aplicar período</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#29261e80",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: t.cream,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "92%",
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  content: { padding: 18, paddingBottom: 32 },
  close: {
    alignSelf: "flex-end",
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { fontSize: 26, color: t.ink },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  art: { width: 80, height: 80 },
  headerCopy: { flex: 1 },
  title: { fontFamily: t.serif, fontSize: 23, color: "#183d2b" },
  help: {
    fontFamily: t.sans,
    fontSize: 11,
    lineHeight: 17,
    color: t.muted,
    marginVertical: 6,
  },
  presets: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: t.line,
  },
  preset: {
    flex: 1,
    minWidth: 66,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 20,
  },
  presetText: { fontFamily: t.sans, fontSize: 10, color: "#183d2b" },
  selected: { backgroundColor: "#365d3e" },
  selectedText: { color: "white" },
  month: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginVertical: 10,
  },
  monthTitle: { fontFamily: t.sans, fontSize: 14, color: "#183d2b" },
  arrow: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0ebdf",
    borderRadius: 24,
  },
  arrowText: { fontSize: 25, color: "#183d2b" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.2857%", padding: 2 },
  weekday: {
    fontFamily: t.sans,
    fontSize: 10,
    color: t.muted,
    textAlign: "center",
    paddingVertical: 5,
  },
  day: {
    minHeight: 40,
    backgroundColor: "#f5f0e7",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: { fontFamily: t.sans, fontSize: 12, color: "#183d2b" },
  inRange: { backgroundColor: "#dce2cc" },
  endpoint: { backgroundColor: "#365d3e", borderRadius: 22 },
  fields: { flexDirection: "row", gap: 12, marginTop: 14 },
  field: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 6,
    padding: 8,
    minHeight: 44,
    fontFamily: t.sans,
    fontSize: 12,
    color: t.ink,
    backgroundColor: "#fffdf7",
  },
  summary: {
    fontFamily: t.sans,
    fontSize: 12,
    lineHeight: 18,
    color: "#183d2b",
    padding: 14,
    textAlign: "center",
    backgroundColor: "#e6ead7",
    borderRadius: 8,
    marginVertical: 10,
  },
  error: {
    fontFamily: t.sans,
    fontSize: 12,
    color: "#a43b20",
    marginBottom: 10,
  },
  actions: { flexDirection: "row", gap: 10 },
  cancel: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#c5bcae",
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
});
