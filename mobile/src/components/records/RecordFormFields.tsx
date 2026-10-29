import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { RecordKind, RecordOptions } from "@inout/finance";
import {
  AuxiliarySelector,
  DateSelector,
} from "../AuxiliarySelector";
import { theme as t } from "../../theme";

interface RecordFormFieldsProps {
  kind: RecordKind;
  fields: {
    accountId: string;
    destinationId: string;
    amount: string;
    categoryId: string;
    sourceId: string;
    date: string;
    description: string;
  };
  options: RecordOptions;
  locked: boolean;
  status: string;
  unavailable: boolean;
  account?: RecordOptions["accounts"][number];
  destinations: RecordOptions["accounts"];
  categories: RecordOptions["categories"];
  parentId: string;
  selectedCategory?: RecordOptions["categories"][number];
  roots: RecordOptions["categories"];
  children: RecordOptions["categories"];
  onEdit: (
    field: "accountId" | "destinationId" | "amount" | "categoryId" | "sourceId" | "date" | "description",
    val: string,
  ) => void;
  creation: (
    target: "account" | "category" | "source",
    field: "accountId" | "destinationId" | "categoryId" | "sourceId",
    parent?: string,
  ) => {
    household: string;
    kind: "account" | "category" | "source";
    flow: RecordKind;
    parentId: string;
    currency: string;
    fixedCurrency: boolean;
    onCreated: (id: string) => void;
  };
  onLayoutField: (field: string, y: number) => void;
  onCancel: () => void;
  onSubmitReview: () => void;
}

export function RecordFormFields({
  kind,
  fields,
  options,
  locked,
  status,
  unavailable,
  account,
  destinations,
  categories,
  parentId,
  selectedCategory,
  roots,
  children,
  onEdit,
  creation,
  onLayoutField,
  onCancel,
  onSubmitReview,
}: RecordFormFieldsProps) {
  const isSaving = status === "saving";
  const isReady = status === "ready";

  return (
    <>
      <Text
        onLayout={(e) => onLayoutField("accountId", e.nativeEvent.layout.y)}
        style={s.label}
      >
        {kind === "income" ? "Conta de destino *" : "Conta de origem *"}
      </Text>
      <AuxiliarySelector
        title={
          kind === "income"
            ? "Selecionar conta de destino"
            : "Selecionar conta de origem"
        }
        value={fields.accountId}
        items={options.accounts.map((a) => ({
          ...a,
          detail: a.currency,
        }))}
        disabled={locked}
        onChange={(id) => onEdit("accountId", id)}
        create={creation("account", "accountId")}
      />

      {kind === "transfer" && (
        <View>
          <Text
            style={{
              textAlign: "center",
              color: "#b58b24",
              fontSize: 26,
            }}
          >
            ↓
          </Text>
          <Text style={s.label}>Conta de destino *</Text>
          <AuxiliarySelector
            title="Selecionar conta de destino"
            value={fields.destinationId}
            items={options.accounts.map((a) => ({
              ...a,
              detail: `${a.currency}${a.id === account?.id ? " · Mesma conta de origem" : a.currency !== account?.currency ? " · Moeda incompatível" : ""}`,
              disabled: a.id === account?.id || a.currency !== account?.currency,
            }))}
            disabled={locked || !account}
            onChange={(id) => onEdit("destinationId", id)}
            create={creation("account", "destinationId")}
          />
          {account && (
            <View style={s.unavailable}>
              <Text style={s.label}>Contas indisponíveis</Text>
              {options.accounts
                .filter(
                  (a) =>
                    a.id === account.id || a.currency !== account.currency,
                )
                .map((a) => (
                  <Text key={a.id} style={s.caption}>
                    {a.name} · {a.currency} —{" "}
                    {a.id === account.id
                      ? "Mesma conta de origem"
                      : "Moeda incompatível"}
                  </Text>
                ))}
            </View>
          )}
        </View>
      )}

      <View>
        <Text style={s.label}>Moeda da conta</Text>
        <View style={[s.input, { backgroundColor: "#efeee8" }]}>
          <Text>{account?.currency ?? "Selecione uma conta"} 🔒</Text>
        </View>
        <Text style={s.caption}>
          A moeda é definida pela conta escolhida.
        </Text>
      </View>

      <Text
        onLayout={(e) => onLayoutField("amount", e.nativeEvent.layout.y)}
        style={s.label}
      >
        Valor * {account ? `(${account.currency})` : ""}
      </Text>
      <TextInput
        accessibilityLabel="Valor"
        editable={!locked}
        keyboardType="decimal-pad"
        style={[
          s.input,
          kind === "expense" && {
            borderLeftWidth: 4,
            borderLeftColor: "#bc4938",
          },
        ]}
        value={fields.amount}
        onChangeText={(value) => onEdit("amount", value)}
        placeholder="1250,50"
      />
      <Text style={s.caption}>
        Use vírgula ou ponto para os centavos, sem separador de milhar.
      </Text>

      {kind !== "transfer" && (
        <>
          <Text
            onLayout={(e) => onLayoutField("categoryId", e.nativeEvent.layout.y)}
            style={s.label}
          >
            Categoria *
          </Text>
          <AuxiliarySelector
            title="Selecionar categoria"
            value={kind === "expense" ? parentId : fields.categoryId}
            items={kind === "expense" ? roots : categories}
            disabled={locked}
            onChange={(id) => onEdit("categoryId", id)}
            create={creation("category", "categoryId")}
          />
        </>
      )}

      {kind === "income" && (
        <>
          <Text
            onLayout={(e) => onLayoutField("sourceId", e.nativeEvent.layout.y)}
            style={s.label}
          >
            Fonte de renda (opcional)
          </Text>
          <AuxiliarySelector
            title="Selecionar fonte de renda"
            value={fields.sourceId}
            items={[{ id: "", name: "Sem fonte" }, ...options.sources]}
            disabled={locked}
            onChange={(id) => onEdit("sourceId", id)}
            create={creation("source", "sourceId")}
          />
        </>
      )}

      {kind === "expense" && (
        <View>
          <Text style={s.label}>Subcategoria (opcional)</Text>
          <AuxiliarySelector
            title="Selecionar subcategoria"
            value={selectedCategory?.parentId ? fields.categoryId : ""}
            items={[
              { id: "", name: "Usar a categoria selecionada" },
              ...children,
            ]}
            context={`Categoria: ${categories.find((c) => c.id === parentId)?.name ?? ""}`}
            disabled={locked || !parentId}
            onChange={(id) => onEdit("categoryId", id || parentId)}
            create={creation("category", "categoryId", parentId)}
          />
        </View>
      )}

      <Text
        onLayout={(e) => onLayoutField("date", e.nativeEvent.layout.y)}
        style={s.label}
      >
        Data *
      </Text>
      <DateSelector
        value={fields.date}
        disabled={locked}
        onChange={(value) => onEdit("date", value)}
      />

      <Text
        onLayout={(e) => onLayoutField("description", e.nativeEvent.layout.y)}
        style={s.label}
      >
        Descrição (opcional)
      </Text>
      <TextInput
        accessibilityLabel="Descrição"
        editable={!locked}
        style={[s.input, s.description]}
        multiline
        maxLength={500}
        value={fields.description}
        onChangeText={(value) => onEdit("description", value)}
      />
      <Text style={[s.caption, { textAlign: "right" }]}>
        {fields.description.length}/500
      </Text>

      {kind === "transfer" && (
        <View style={s.transferNotice}>
          <Text style={s.help}>
            ⓘ Transferências não contam como receita ou despesa.
          </Text>
          <Text style={s.caption}>
            Escolha contas diferentes e com a mesma moeda.
          </Text>
        </View>
      )}

      <Text style={s.caption}>* Campos obrigatórios</Text>

      <Pressable
        accessibilityRole="button"
        disabled={isSaving}
        style={s.cancel}
        onPress={onCancel}
      >
        <Text style={s.link}>Cancelar</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{
          disabled: isSaving || (isReady && unavailable),
          busy: isSaving,
        }}
        disabled={isSaving || (isReady && unavailable)}
        style={[
          s.button,
          kind === "expense" && { backgroundColor: "#bc4938" },
        ]}
        onPress={onSubmitReview}
      >
        <Text style={s.buttonText}>
          {isSaving
            ? "Salvando…"
            : kind === "income"
              ? "Revisar entrada"
              : kind === "expense"
                ? "Revisar saída"
                : "Revisar transferência"}
        </Text>
      </Pressable>
    </>
  );
}

const s = StyleSheet.create({
  unavailable: {
    padding: 12,
    backgroundColor: "#efeee7",
    borderRadius: 10,
    marginTop: 8,
    gap: 7,
  },
  transferNotice: {
    padding: 14,
    backgroundColor: "#f5efd3",
    borderRadius: 10,
    gap: 8,
    marginTop: 12,
  },
  label: {
    fontFamily: t.sans,
    fontSize: 14,
    color: "#1d4530",
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#dfd7c4",
    borderRadius: 10,
    padding: 12,
    fontFamily: t.sans,
    fontSize: 15,
    color: "#203c2a",
    backgroundColor: "#fffdf8",
  },
  description: { height: 90, textAlignVertical: "top" },
  caption: { fontFamily: t.sans, fontSize: 11, color: t.muted },
  help: { fontFamily: t.sans, fontSize: 14, color: "#4c5749", lineHeight: 21 },
  button: {
    minHeight: 48,
    backgroundColor: "#315f3b",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  buttonText: { fontFamily: t.sans, fontSize: 15, color: "white" },
  cancel: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#56806a",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  link: { fontFamily: t.sans, fontSize: 14, color: "#315f3b" },
});
