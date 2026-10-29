import { useState, useRef, type ComponentRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  recordReview,
  financeMessage,
  type RecordKind,
  type RecordReview,
} from "@inout/finance";
import { useFinancialHome } from "../finance/use-financial-home";
import { useRecord } from "../finance/use-record";
import { theme as t } from "../theme";
import { RecordSaved } from "../components/RecordSaved";
import { PendingVerificationScreen } from "./PendingVerificationScreen";
import { NewRecordPicker } from "../components/NewRecordPicker";
import { RecordReviewPanel } from "../components/RecordReview";
import {
  useCategoryHierarchy,
  RecordHeader,
  RecordUnavailableAlert,
  RecordFormFields,
  recordTitles,
} from "../components/records";

export function NewRecordScreen() {
  const p = useLocalSearchParams(),
    kind = typeof p.kind === "string" ? p.kind : "",
    household = typeof p.household === "string" ? p.household : "",
    period = typeof p.period === "string" ? p.period : "",
    currency = typeof p.currency === "string" ? p.currency : "";

  if (!["income", "expense", "transfer"].includes(kind)) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <Text style={s.title}>Tipo de movimentação inválido</Text>
          <Pressable
            accessibilityRole="button"
            style={s.button}
            onPress={() => router.replace("/inicio")}
          >
            <Text style={s.buttonText}>Voltar ao início</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <RecordView
      key={`${kind}:${household}:${period}:${currency}:${typeof p.draft === "string" ? p.draft : ""}`}
      kind={kind as RecordKind}
      household={household}
      period={period}
      currency={currency}
    />
  );
}

function RecordView({
  kind,
  household,
  period,
  currency,
}: {
  kind: RecordKind;
  household: string;
  period: string;
  currency: string;
}) {
  const home = useFinancialHome({
    initialHouseholdId: household,
    initialPeriod: period,
  });

  if (home.status !== "ready" || !home.data) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <Text style={s.title}>{recordTitles[kind]}</Text>
          <Text accessibilityLiveRegion="polite" style={s.help}>
            {home.status === "loading"
              ? "Carregando residência…"
              : home.notice || "Nenhuma residência disponível."}
          </Text>
          {home.status !== "loading" ? (
            <Pressable
              accessibilityRole="button"
              style={s.button}
              onPress={home.retry}
            >
              <Text style={s.buttonText}>Tentar novamente</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            style={s.textButton}
            onPress={() => router.replace("/inicio")}
          >
            <Text style={s.link}>Voltar ao início</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <RecordForm
      household={home.householdId}
      period={home.period}
      currency={currency}
      kind={kind}
      householdName={
        home.households.find((row) => row.id === home.householdId)?.name ??
        "Residência"
      }
    />
  );
}

function RecordForm({
  household,
  period,
  currency,
  kind,
  householdName,
}: {
  household: string;
  period: string;
  currency: string;
  kind: RecordKind;
  householdName: string;
}) {
  const state = useRecord(household, kind, currency);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const positions = useRef<Record<string, number>>({});

  const back = () => {
    if (reviewing && state.status === "ready") {
      setReviewing(false);
      return;
    }
    router.replace({
      pathname: "/lancamentos",
      params: { household, period, currency },
    });
  };

  if (state.status === "loading" || state.status === "error" || !state.options) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <Text style={s.title}>{recordTitles[kind]}</Text>
          <Text accessibilityLiveRegion="polite" style={s.help}>
            {state.status === "loading"
              ? "Carregando contas e categorias…"
              : state.notice}
          </Text>
          {state.status === "error" ? (
            <Pressable
              accessibilityRole="button"
              style={s.button}
              onPress={state.retry}
            >
              <Text style={s.buttonText}>Tentar novamente</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            style={s.textButton}
            onPress={back}
          >
            <Text style={s.link}>Voltar ao início</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const options = state.options;
  const fields = state.fields;
  const locked = state.status !== "ready";
  const account = options.accounts.find((row) => row.id === fields.accountId);

  const { flowCategories, selectedCategory, parentId, roots, children } =
    useCategoryHierarchy(options.categories, state.kind, fields.categoryId);

  const destinations = options.accounts.filter(
    (row) =>
      row.id !== fields.accountId && row.currency === account?.currency,
  );

  const unavailable =
    !options.accounts.length ||
    (state.kind === "transfer" ? !destinations.length : !flowCategories.length);

  const creation = (
    target: "account" | "category" | "source",
    field: "accountId" | "destinationId" | "categoryId" | "sourceId",
    parent = "",
  ) => ({
    household,
    kind: target,
    flow: state.kind,
    parentId: parent,
    currency: account?.currency || currency || "BRL",
    fixedCurrency: field === "destinationId",
    onCreated: (id: string) => {
      state.edit(field, id);
      state.retry();
    },
  });

  const showReview =
    (reviewing && state.status !== "success") ||
    state.status === "uncertain" ||
    state.status === "saving";

  let summary: RecordReview | null = null;
  if (showReview || state.status === "success") {
    try {
      summary = recordReview(state.kind, fields, options);
    } catch {
      /* A pending operation can reference an archived option. Its original payload remains available for retry. */
    }
  }

  function review() {
    try {
      recordReview(state.kind, fields, options);
      setReviewError("");
      setReviewing(true);
      scroll.current?.scrollTo({ y: 0, animated: true });
    } catch (error) {
      setReviewError(financeMessage(error));
    }
  }

  if (state.status === "uncertain") {
    return (
      <PendingVerificationScreen
        household={household}
        householdName={householdName}
        kind={state.kind}
        summary={summary}
        description={fields.description}
        amount={fields.amount}
        currency={account?.currency ?? currency}
        accountName={account?.name ?? ""}
        date={fields.date}
        onRetry={() => void state.submit()}
        submitting={false}
      />
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        {state.status !== "success" && (
          <RecordHeader
            kind={state.kind}
            householdName={householdName}
            showReview={showReview}
            status={state.status}
            onBack={back}
          />
        )}

        {state.status === "success" ? (
          <RecordSaved
            kind={state.kind}
            summary={summary}
            description={fields.description}
            transactionId={state.result!.transactionId}
            onNew={() => setNewOpen(true)}
            onHistory={() =>
              router.replace({
                pathname: "/lancamentos",
                params: {
                  household,
                  period: fields.date.slice(0, 7),
                  currency: account?.currency ?? currency,
                },
              })
            }
            onDetails={() =>
              router.push({
                pathname: "/lancamento",
                params: {
                  household,
                  period: fields.date.slice(0, 7),
                  currency: account?.currency ?? currency,
                  transaction: state.result!.transactionId,
                },
              })
            }
          />
        ) : showReview ? (
          <RecordReviewPanel
            kind={state.kind}
            summary={summary}
            status={state.status}
            notice={state.notice}
            onEdit={(field) => {
              setReviewing(false);
              setTimeout(
                () =>
                  scroll.current?.scrollTo({
                    y: positions.current[field ?? "amount"] ?? 0,
                    animated: true,
                  }),
                0,
              );
            }}
            onConfirm={() => void state.submit()}
          />
        ) : (
          <>
            {reviewError ? (
              <Text accessibilityRole="alert" style={s.notice}>
                {reviewError}
              </Text>
            ) : null}
            {state.notice ? (
              <Text accessibilityLiveRegion="assertive" style={s.notice}>
                {state.notice}
              </Text>
            ) : null}

            <RecordUnavailableAlert
              unavailable={unavailable}
              locked={locked}
              accountsLength={options.accounts.length}
              kind={state.kind}
            />

            <RecordFormFields
              kind={state.kind}
              fields={fields}
              options={options}
              locked={locked}
              status={state.status}
              unavailable={unavailable}
              account={account}
              destinations={destinations}
              categories={flowCategories}
              parentId={parentId}
              selectedCategory={selectedCategory}
              roots={roots}
              children={children}
              onEdit={(field, val) => state.edit(field, val)}
              creation={creation}
              onLayoutField={(field, y) => {
                positions.current[field] = y;
              }}
              onCancel={back}
              onSubmitReview={review}
            />
          </>
        )}
      </ScrollView>

      {newOpen && (
        <NewRecordPicker
          household={household}
          period={fields.date.slice(0, 7)}
          currency={account?.currency ?? currency}
          fresh
          onClose={() => setNewOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.cream },
  content: {
    padding: 22,
    paddingBottom: 40,
    gap: 8,
    maxWidth: 620,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontFamily: t.serif,
    fontSize: 28,
    color: "#173e2b",
    marginBottom: 8,
  },
  help: { fontFamily: t.sans, fontSize: 14, color: "#4c5749", lineHeight: 21 },
  notice: {
    fontFamily: t.sans,
    fontSize: 14,
    color: "#9b4229",
    lineHeight: 21,
    marginVertical: 10,
  },
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
  textButton: { minHeight: 44, justifyContent: "center" },
  link: { fontFamily: t.sans, fontSize: 14, color: "#315f3b" },
});
