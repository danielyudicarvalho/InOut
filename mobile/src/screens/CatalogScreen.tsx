import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Modal,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  categoryParentChoices,
  canArchiveCategory,
  type CatalogItem,
  type CatalogCategory,
  type CatalogType,
} from "@inout/finance/catalog";
import { money, displayDate, periodLabel } from "@inout/finance";
import { useFinancialHome } from "../finance/use-financial-home";
import { useCatalog } from "../finance/use-catalog";
import { useLedgerHistory } from "../finance/use-ledger-history";
import { useSourceShare } from "../finance/use-source-share";
import { PeriodPicker } from "../components/PeriodPicker";
import { theme as t } from "../theme";
export function CatalogScreen({ type }: { type: CatalogType }) {
  const p = useLocalSearchParams();
  const home = useFinancialHome({
    initialHouseholdId: typeof p.household === "string" ? p.household : "",
    initialPeriod: typeof p.period === "string" ? p.period : "",
  });
  if (home.status !== "ready")
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <Text style={s.title}>
            {type === "categories" ? "Categorias" : "Fontes de renda"}
          </Text>
          <Text accessibilityRole="alert">
            {home.status === "loading"
              ? "Preparando seu Ninho…"
              : home.notice || "Escolha uma residência."}
          </Text>
          <Action label="Atualizar" onPress={home.retry} />
          <Action
            label="Escolher residência"
            onPress={() => router.push("/comecar")}
          />
        </View>
      </SafeAreaView>
    );
  return (
    <CatalogView
      key={`${home.householdId}:${type}`}
      type={type}
      household={home.householdId}
      period={home.period}
      setPeriod={home.selectPeriod}
      homeName={
        home.households.find((h) => h.id === home.householdId)?.name ??
        "Seu Ninho"
      }
    />
  );
}
function CatalogView({
  type,
  household,
  period,
  setPeriod,
  homeName,
}: {
  type: CatalogType;
  household: string;
  period: string;
  setPeriod: (v: string) => void;
  homeName: string;
}) {
  const state = useCatalog(household);
  const [archived, setArchived] = useState(false),
    [flow, setFlow] = useState<"income" | "expense">("expense"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(""),
    [creating, setCreating] = useState(false),
    [archiving, setArchiving] = useState<CatalogItem | null>(null),
    [name, setName] = useState(""),
    [parent, setParent] = useState(""),
    [picker, setPicker] = useState(false);
  const categories = type === "categories",
    title = categories ? "Categorias" : "Fontes de renda",
    art = categories
      ? require("../../assets/pipo-catalog.png")
      : require("../../assets/pipo-source-garden.png");
  const all = categories ? state.categories : state.sources;
  const shown = all.filter(
    (item) =>
      Boolean(item.archivedAt) === archived &&
      (!categories || (item as CatalogCategory).flow === flow) &&
      item.name
        .toLocaleLowerCase("pt-BR")
        .includes(search.trim().toLocaleLowerCase("pt-BR")),
  );
  shown.sort((a, b) => {
    const path = (row: CatalogItem) => {
      const parentId = (row as CatalogCategory).parentId;
      const root = state.categories.find((c) => c.id === parentId);
      return `${root?.name ?? row.name}\u0000${parentId ? row.name : ""}`;
    };
    return path(a).localeCompare(path(b), "pt-BR");
  });
  const item = all.find((row) => row.id === selected),
    children = state.categories.filter((row) => row.parentId === item?.id),
    parents = categoryParentChoices(state.categories, flow);
  const go = (
    path: "/inicio" | "/categorias" | "/gerenciar-fontes" | "/lancamentos",
    extra: Record<string, string> = {},
  ) => router.push({ pathname: path, params: { household, period, ...extra } });
  const newForm = (id = "") => {
    setName("");
    setParent(id);
    setCreating(true);
  };
  const close = () => {
    if (!state.busy) {
      setCreating(false);
      setArchiving(null);
    }
  };
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <Action
          label={`‹ Início · ${homeName}`}
          onPress={() => go("/inicio")}
        />
        <View style={s.hero}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>Cada registro no seu cantinho</Text>
            <Text style={s.title}>{title}</Text>
            <Text style={s.body}>
              {categories
                ? "Organize as entradas e saídas do seu lar."
                : "Cuide das origens da renda do seu lar."}
            </Text>
          </View>
          <Image
            source={art}
            style={s.heroArt}
            accessibilityLabel="Pipo organizando o Ninho"
            resizeMode="contain"
          />
        </View>
        <Action
          primary
          label={categories ? "＋ Nova categoria" : "＋ Nova fonte"}
          disabled={
            state.busy ||
            state.loading ||
            Boolean(state.pending) ||
            Boolean(state.error)
          }
          onPress={() => newForm()}
        />
        <View style={s.row}>
          <Action
            label="Categorias"
            selected={categories}
            onPress={() => go("/categorias")}
          />
          <Action
            label="Fontes de renda"
            selected={!categories}
            onPress={() => go("/gerenciar-fontes")}
          />
        </View>
        {categories ? (
          <View style={s.row}>
            <Action
              label="Saídas"
              selected={flow === "expense"}
              onPress={() => {
                setFlow("expense");
                setSelected("");
              }}
            />
            <Action
              label="Entradas"
              selected={flow === "income"}
              onPress={() => {
                setFlow("income");
                setSelected("");
              }}
            />
          </View>
        ) : null}
        <View style={s.row}>
          <Action
            label="Ativas"
            selected={!archived}
            onPress={() => setArchived(false)}
          />
          <Action
            label="Arquivadas"
            selected={archived}
            onPress={() => setArchived(true)}
          />
          <Action
            label="Atualizar"
            disabled={state.busy}
            onPress={state.retry}
          />
        </View>
        <TextInput
          accessibilityLabel="Buscar pelo nome"
          placeholder="Buscar pelo nome"
          style={s.input}
          value={search}
          onChangeText={setSearch}
        />
        {state.notice ? (
          <Text style={s.notice} accessibilityRole="alert">
            {state.notice}
          </Text>
        ) : null}
        {state.pending ? (
          <View style={s.card}>
            <Text style={s.heading}>Cadastro aguardando confirmação</Text>
            <Text style={s.body}>
              Vamos verificar “{state.pending.body.name}” usando a mesma
              identificação, sem criar uma cópia.
            </Text>
            <Action
              label="Verificar e recuperar cadastro"
              disabled={state.busy || state.loading || Boolean(state.error)}
              onPress={state.recover}
            />
          </View>
        ) : null}
        {state.loading ? (
          <Text accessibilityLiveRegion="polite">Carregando…</Text>
        ) : state.error ? (
          <View style={s.card}>
            <Text accessibilityRole="alert">{state.error}</Text>
            <Action label="Tentar novamente" onPress={state.retry} />
          </View>
        ) : (
          <>
            {shown.length ? (
              shown.map((row) => {
                const category = row as CatalogCategory,
                  root = category.parentId
                    ? state.categories.find((c) => c.id === category.parentId)
                    : null;
                return (
                  <Pressable
                    key={row.id}
                    style={[s.card, category.parentId ? s.child : null]}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: selected === row.id }}
                    onPress={() => setSelected(row.id)}
                  >
                    <Text style={s.heading}>❀ {row.name} ›</Text>
                    <Text style={s.muted}>
                      {root
                        ? `${root.name} › Subcategoria`
                        : categories
                          ? "Categoria principal"
                          : "Fonte de renda"}{" "}
                      · {row.archivedAt ? "Arquivada" : "Ativa"}
                    </Text>
                  </Pressable>
                );
              })
            ) : (
              <View style={s.card}>
                <Text style={s.heading}>
                  {search
                    ? "Nenhum resultado"
                    : archived
                      ? "Seu arquivo está vazio"
                      : "Vamos organizar seu Ninho?"}
                </Text>
                <Text style={s.body}>
                  {search
                    ? "Tente outro nome."
                    : archived
                      ? "Cadastros arquivados mantêm o histórico."
                      : "Use o botão acima para criar o primeiro cadastro."}
                </Text>
              </View>
            )}
            {item ? (
              <View style={s.card}>
                <Text style={s.eyebrow}>
                  {categories ? "Detalhe da categoria" : "Detalhe da fonte"}
                </Text>
                <Text style={s.title}>{item.name}</Text>
                <Text style={s.body}>
                  {item.archivedAt
                    ? `Arquivada em ${displayDate(item.archivedAt.slice(0, 10))}. Seu histórico continua disponível.`
                    : "Ativa para novos lançamentos."}
                </Text>
                {categories ? (
                  <>
                    <Text style={s.heading}>Subcategorias</Text>
                    {(item as CatalogCategory).parentId ? (
                      <Text style={s.body}>
                        Esta é uma subcategoria. Há apenas um nível.
                      </Text>
                    ) : (
                      <>
                        {children.map((child) => (
                          <Action
                            key={child.id}
                            label={`${child.name} · ${child.archivedAt ? "Arquivada" : "Ativa"}`}
                            onPress={() => setSelected(child.id)}
                          />
                        ))}
                        {!children.length ? (
                          <Text style={s.body}>Ainda sem subcategorias.</Text>
                        ) : null}
                        {!item.archivedAt ? (
                          <Action
                            label="＋ Nova subcategoria"
                            disabled={state.busy || Boolean(state.pending)}
                            onPress={() => newForm(item.id)}
                          />
                        ) : null}
                      </>
                    )}
                  </>
                ) : null}
                <Action
                  label={`${periodLabel(period)} · Alterar período`}
                  onPress={() => setPicker(true)}
                />
                {!categories
                  ? state.currencies.map((currency) => (
                      <SourceShare
                        key={`${item.id}:${period}:${currency}`}
                        household={household}
                        period={period}
                        currency={currency}
                        sourceId={item.id}
                      />
                    ))
                  : null}
                <CatalogHistory
                  key={`${item.id}:${period}`}
                  household={household}
                  period={period}
                  id={item.id}
                  type={type}
                />
                <Action
                  label="Ver todas as movimentações →"
                  onPress={() =>
                    go("/lancamentos", {
                      [categories ? "categoryId" : "incomeSourceId"]: item.id,
                    })
                  }
                />
                {!item.archivedAt ? (
                  <Action
                    label={categories ? "Arquivar categoria" : "Arquivar fonte"}
                    disabled={state.busy || Boolean(state.pending)}
                    onPress={() => setArchiving(item)}
                  />
                ) : null}
              </View>
            ) : (
              <Text style={s.body}>
                Selecione um cadastro para consultar detalhes e movimentações.
              </Text>
            )}
          </>
        )}
        <Text style={s.muted}>
          Arquivar mantém a identificação dos lançamentos antigos. Subcategorias
          têm o fluxo da categoria principal.
        </Text>
      </ScrollView>
      <Modal
        visible={creating || Boolean(archiving)}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <View style={s.overlay}>
          <ScrollView
            contentContainerStyle={s.modal}
            keyboardShouldPersistTaps="handled"
            accessibilityViewIsModal
          >
            <Image
              source={
                archiving ? require("../../assets/pipo-archive.png") : art
              }
              style={s.dialogArt}
              resizeMode="contain"
              accessibilityLabel="Pipo cuidando dos seus registros"
            />
            {creating ? (
              <>
                <Text style={s.title}>
                  {categories
                    ? parent
                      ? "Nova subcategoria"
                      : "Nova categoria"
                    : "Nova fonte de renda"}
                </Text>
                <Text style={s.heading}>Nome</Text>
                <TextInput
                  accessibilityLabel="Nome"
                  autoFocus
                  maxLength={80}
                  value={name}
                  onChangeText={setName}
                  editable={!state.busy && !state.pending}
                  style={s.input}
                />
                {categories ? (
                  <>
                    <Text style={s.heading}>Fluxo financeiro</Text>
                    <View style={s.row}>
                      {(["expense", "income"] as const).map((f) => (
                        <Action
                          key={f}
                          label={f === "income" ? "Entrada" : "Saída"}
                          selected={flow === f}
                          disabled={state.busy || Boolean(state.pending)}
                          onPress={() => {
                            setFlow(f);
                            setParent("");
                          }}
                        />
                      ))}
                    </View>
                    <Text style={s.heading}>Categoria principal</Text>
                    <Action
                      label="Sem categoria principal"
                      selected={!parent}
                      disabled={state.busy || Boolean(state.pending)}
                      onPress={() => setParent("")}
                    />
                    {parents.map((c) => (
                      <Action
                        key={c.id}
                        label={c.name}
                        selected={parent === c.id}
                        disabled={state.busy || Boolean(state.pending)}
                        onPress={() => setParent(c.id)}
                      />
                    ))}
                    <Text style={s.body}>
                      Apenas categorias principais ativas do mesmo fluxo. O
                      Ninho permite um nível de subcategoria.
                    </Text>
                  </>
                ) : (
                  <Text style={s.body}>
                    Identifique de onde vem a receita, como salário ou trabalho
                    autônomo.
                  </Text>
                )}
                <Action
                  primary
                  label={state.busy ? "Salvando…" : "Salvar"}
                  disabled={
                    state.busy || Boolean(state.pending) || !name.trim()
                  }
                  onPress={async () => {
                    if (
                      await state.create(type, {
                        name,
                        flow,
                        parentId: parent || null,
                      })
                    )
                      setCreating(false);
                  }}
                />
                {state.pending ? (
                  <Text style={s.body}>
                    Feche este painel e use a recuperação do cadastro pendente.
                  </Text>
                ) : null}
              </>
            ) : archiving ? (
              <>
                <Text style={s.title}>Arquivar {archiving.name}?</Text>
                <Text style={s.body}>
                  O cadastro ficará indisponível para novos lançamentos.
                  Receitas e despesas antigas manterão sua identificação e
                  continuarão no histórico.
                </Text>
                {categories &&
                !canArchiveCategory(state.categories, archiving.id) ? (
                  <Text accessibilityRole="alert" style={s.notice}>
                    Arquive as subcategorias ativas antes de continuar.
                  </Text>
                ) : null}
                <Action
                  primary
                  label={state.busy ? "Arquivando…" : "Confirmar arquivamento"}
                  disabled={
                    state.busy ||
                    (categories &&
                      !canArchiveCategory(state.categories, archiving.id))
                  }
                  onPress={async () => {
                    if (await state.archive(type, archiving.id))
                      setArchiving(null);
                  }}
                />
              </>
            ) : null}
            {state.notice ? (
              <Text style={s.notice} accessibilityRole="alert">
                {state.notice}
              </Text>
            ) : null}
            <Action
              label={archiving ? "Cancelar" : "Fechar"}
              disabled={state.busy}
              onPress={close}
            />
          </ScrollView>
        </View>
      </Modal>
      {picker ? (
        <PeriodPicker
          value={period}
          onClose={() => setPicker(false)}
          onApply={(value) => {
            setPeriod(value);
            setPicker(false);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}
function Action({
  label,
  onPress,
  disabled = false,
  selected,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={[
        s.button,
        (selected || primary) && s.selected,
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text
        style={[s.buttonText, (selected || primary) && { color: "#fffdf5" }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
function CatalogHistory({
  household,
  period,
  id,
  type,
}: {
  household: string;
  period: string;
  id: string;
  type: CatalogType;
}) {
  const history = useLedgerHistory(
    household,
    period,
    { [type === "categories" ? "categoryId" : "incomeSourceId"]: id },
    0,
  );
  return (
    <View>
      <Text style={s.heading}>Movimentações do período</Text>
      {type === "categories" ? (
        <Text style={s.body}>
          Registros diretamente nesta categoria. Consulte cada subcategoria para
          seus registros.
        </Text>
      ) : null}
      {history.loading ? (
        <Text>Carregando registros…</Text>
      ) : history.error ? (
        <>
          <Text accessibilityRole="alert">{history.error}</Text>
          <Action label="Tentar novamente" onPress={history.retry} />
        </>
      ) : history.items.length ? (
        history.items.slice(0, 5).map((row, i) => (
          <Pressable
            key={`${row.transactionId}:${i}`}
            accessibilityRole="button"
            style={s.historyRow}
            onPress={() =>
              router.push({
                pathname: "/lancamento",
                params: { household, period, transaction: row.transactionId },
              })
            }
          >
            <Text style={s.heading}>{row.description}</Text>
            <Text style={s.muted}>
              {displayDate(row.date)} · {row.accountName} ·{" "}
              {row.status === "reversed" ? "Estornado" : "Registrado"}
            </Text>
            <Text style={s.body}>{money(row.amount, row.currency)} ›</Text>
          </Pressable>
        ))
      ) : (
        <Text style={s.body}>Sem movimentações neste período.</Text>
      )}
    </View>
  );
}
function SourceShare({
  household,
  period,
  currency,
  sourceId,
}: {
  household: string;
  period: string;
  currency: string;
  sourceId: string;
}) {
  const state = useSourceShare(household, period, currency);
  if (state.status !== "ready" || !state.data)
    return (
      <View>
        <Text>
          {state.status === "loading"
            ? "Carregando participação…"
            : "Participação indisponível."}
        </Text>
        {state.status !== "loading" ? (
          <Action label="Atualizar" onPress={state.retry} />
        ) : null}
      </View>
    );
  const data = state.data,
    source = data.sources?.find((row) => row.id === sourceId),
    amount = source?.amount ?? 0;
  const percentage =
    data.total > 0 && data.sources?.every((row) => row.amount >= 0)
      ? Math.round((amount / data.total) * 100)
      : null;
  return (
    <View style={s.share}>
      <Text style={s.amount}>{money(amount, currency)}</Text>
      <Text style={s.body}>
        {percentage === null
          ? "Percentual não se aplica com receitas líquidas negativas ou total zero."
          : `${percentage}% das receitas em ${currency} no período.`}
      </Text>
      <Text style={s.muted}>
        Valores líquidos, incluindo estornos. Moedas separadas.
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.cream },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  title: {
    fontFamily: t.serif,
    fontSize: 28,
    color: "#244735",
    marginVertical: 8,
  },
  eyebrow: { fontSize: 12, color: "#62774d", fontFamily: t.sans },
  hero: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroArt: { width: 120, height: 140 },
  dialogArt: { width: 200, height: 140, alignSelf: "center" },
  body: {
    fontFamily: t.sans,
    color: t.muted,
    lineHeight: 23,
    marginVertical: 8,
  },
  heading: {
    fontFamily: t.serif,
    color: "#244735",
    fontSize: 18,
    marginVertical: 6,
  },
  muted: { fontFamily: t.sans, fontSize: 12, color: t.muted, lineHeight: 19 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  button: {
    minHeight: 44,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ded7bf",
    backgroundColor: "#fffdf5",
    justifyContent: "center",
    marginVertical: 3,
  },
  buttonText: { color: "#244735", fontFamily: t.sans },
  selected: { backgroundColor: "#355d41", borderColor: "#355d41" },
  input: {
    borderWidth: 1,
    borderColor: "#ded7bf",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#fffdf5",
    color: "#244735",
    minHeight: 48,
  },
  card: {
    padding: 20,
    backgroundColor: "#fffdf5",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e4dbc5",
    gap: 6,
  },
  child: { marginLeft: 18, borderLeftWidth: 3, borderLeftColor: "#9aac83" },
  notice: {
    backgroundColor: "#f2ead1",
    padding: 16,
    borderRadius: 14,
    color: "#5b492b",
    lineHeight: 23,
  },
  overlay: {
    flex: 1,
    backgroundColor: "#172a2566",
    justifyContent: "center",
    padding: 20,
  },
  modal: { backgroundColor: t.cream, padding: 24, borderRadius: 24, gap: 12 },
  share: {
    backgroundColor: "#eef0de",
    borderRadius: 18,
    padding: 16,
    marginVertical: 10,
  },
  amount: { fontSize: 25, color: "#244735", fontFamily: t.serif },
  historyRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e4dbc5",
  },
});
