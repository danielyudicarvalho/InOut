import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  Modal,
  TextInput,
  StyleSheet,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  roleLabel,
  memberLabel,
  lastOwner,
  invitationStatus,
  type HouseholdMember,
  type HouseholdRole,
} from "@inout/finance/collaboration";
import { useCollaboration } from "../finance/use-collaboration";
import { theme as t } from "../theme";
const roleCopy = {
  owner:
    "Compartilha as finanças e pode gerar ou revogar convites, alterar papéis e remover participantes. Deve haver pelo menos um responsável.",
  member:
    "Compartilha as contas e os lançamentos. Pode registrar movimentações e sair da residência. Não gerencia participantes ou convites.",
};
export function HouseholdManagementScreen({
  choose = false,
}: {
  choose?: boolean;
}) {
  const p = useLocalSearchParams();
  const id = !choose && typeof p.household === "string" ? p.household : "";
  return <HouseholdView key={id} initial={id} />;
}
function HouseholdView({ initial }: { initial: string }) {
  const state = useCollaboration(initial);
  const [tab, setTab] = useState<"home" | "members" | "invites">("home"),
    [selected, setSelected] = useState(""),
    [dialog, setDialog] = useState<
      "role" | "remove" | "leave" | "invite" | "revoke" | null
    >(null),
    [targetRole, setTargetRole] = useState<HouseholdRole>("member"),
    [inviteId, setInviteId] = useState(""),
    [copyNotice, setCopyNotice] = useState("");
  const context = state.context,
    member = context?.members.find((m) => m.userId === selected),
    owner = context?.role === "owner";
  const select = (household: string) => {
    setSelected("");
    setDialog(null);
    state.select(household);
    router.replace({ pathname: "/residencia", params: { household } });
  };
  if (state.status === "removed") return <AccessRemoved />;
  if (state.loading)
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <Text style={s.title}>Minha residência</Text>
          <Text>Abrindo as portas do Ninho…</Text>
        </View>
      </SafeAreaView>
    );
  if (state.status === "error")
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <Text style={s.title}>Não foi possível carregar</Text>
          <Text accessibilityRole="alert">{state.notice}</Text>
          <Action label="Tentar novamente" onPress={state.retry} />
          <Action
            label="Escolher residência"
            onPress={() => router.replace("/selecionar-residencia")}
          />
        </View>
      </SafeAreaView>
    );
  if (state.status === "choose" || !context)
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.content}>
          <Image
            source={require("../../assets/pipo-household.png")}
            style={s.art}
            resizeMode="contain"
            accessibilityLabel="Pipo recebe você em um lar acolhedor"
          />
          <Text style={s.title}>Qual Ninho vamos abrir?</Text>
          <Text style={s.body}>
            Você acessa apenas as residências das quais participa.
          </Text>
          {state.homes.map((h) => (
            <Action
              key={h.id}
              label={`${h.name} →`}
              onPress={() => select(h.id)}
            />
          ))}
          {!state.homes.length ? (
            <Text>Você ainda não participa de uma residência.</Text>
          ) : null}
          <Action
            label="Criar residência"
            onPress={() => router.push("/criar-residencia")}
          />
          <Action
            label="Usar um convite"
            onPress={() => router.push("/entrar-convite")}
          />
        </ScrollView>
      </SafeAreaView>
    );
  const locked = Boolean(member && lastOwner(context, member));
  const chooseMember = (m: HouseholdMember) => {
    setSelected(m.userId);
    setTargetRole(m.role);
  };
  const confirmation = async () => {
    let ok = false;
    if (dialog === "invite") {
      ok = await state.invite();
      if (ok) setTab("invites");
    } else if (dialog === "leave") {
      ok = await state.leave();
      if (ok) router.replace("/acesso-removido");
    } else if (dialog === "role" && member)
      ok = await state.role(member.userId, targetRole);
    else if (dialog === "remove" && member)
      ok = await state.remove(member.userId);
    else if (dialog === "revoke") ok = await state.revoke(inviteId);
    if (ok) setDialog(null);
  };
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <Action
          label="‹ Início"
          onPress={() =>
            router.push({
              pathname: "/inicio",
              params: { household: state.household },
            })
          }
        />
        <Image
          source={require("../../assets/pipo-household.png")}
          style={s.art}
          resizeMode="contain"
          accessibilityLabel="Pipo e um amigo acolhem você no Ninho"
        />
        <Text style={s.eyebrow}>Um lar que cuidamos juntos</Text>
        <Text style={s.title}>{context.name}</Text>
        <Text style={s.body}>
          Seu papel: {roleLabel(context.role)} · {context.members.length}/
          {context.maximumMembers} participantes
        </Text>
        <Action
          label="Trocar residência"
          onPress={() => router.replace("/selecionar-residencia")}
        />
        <View style={s.row}>
          <Action
            label="Minha residência"
            selected={tab === "home"}
            onPress={() => setTab("home")}
          />
          <Action
            label="Membros"
            selected={tab === "members"}
            onPress={() => setTab("members")}
          />
          {owner ? (
            <Action
              label="Convites"
              selected={tab === "invites"}
              onPress={() => setTab("invites")}
            />
          ) : null}
          <Action
            label="Atualizar"
            disabled={state.busy}
            onPress={state.retry}
          />
        </View>
        {state.notice ? (
          <Text accessibilityRole="alert" style={s.notice}>
            {state.notice}
          </Text>
        ) : null}
        {tab === "home" || (tab === "invites" && !owner) ? (
          <View style={s.card}>
            <Text style={s.heading}>Um contexto compartilhado</Text>
            <Text style={s.body}>
              Contas, categorias, fontes e movimentações pertencem à residência.
              Esta área não acompanha gastos ou hábitos individuais.
            </Text>
            <Text style={s.body}>{roleCopy[context.role]}</Text>
            <Text style={s.body}>
              Limite atual: dois participantes. Você pode participar de mais de
              uma residência e alternar entre elas.
            </Text>
            <Action
              label="Gerenciar membros"
              onPress={() => setTab("members")}
            />
            {owner ? (
              <Action
                primary
                label="Convidar membro"
                disabled={
                  state.busy || context.members.length >= context.maximumMembers
                }
                onPress={() => setDialog("invite")}
              />
            ) : null}
            <Action
              label="Sair da residência"
              disabled={state.busy}
              onPress={() => setDialog("leave")}
            />
          </View>
        ) : null}
        {tab === "members" ? (
          <>
            {context.members.map((m) => (
              <Pressable
                key={m.userId}
                accessibilityRole="button"
                accessibilityState={{ expanded: selected === m.userId }}
                style={s.card}
                onPress={() => chooseMember(m)}
              >
                <Text style={s.heading}>
                  ⌂ {memberLabel(m, context.actorId)} ›
                </Text>
                <Text style={s.body}>{roleLabel(m.role)} · Ativo</Text>
                <Text style={s.muted}>
                  Desde {new Date(m.joinedAt).toLocaleDateString("pt-BR")}
                </Text>
              </Pressable>
            ))}
            {member ? (
              <View style={s.card}>
                <Text style={s.eyebrow}>Detalhe do membro</Text>
                <Text style={s.title}>
                  {memberLabel(member, context.actorId)}
                </Text>
                <Text style={s.body}>{roleLabel(member.role)} · Ativo</Text>
                <Text selectable style={s.muted}>
                  Identificação: {member.userId}
                </Text>
                <Text style={s.body}>{roleCopy[member.role]}</Text>
                <Text style={s.body}>
                  Sem gastos, rankings ou monitoramento individual nesta área.
                </Text>
                {locked ? (
                  <Text style={s.notice}>
                    Último responsável. Promova outro participante antes de
                    alterar este papel ou encerrar a participação.
                  </Text>
                ) : null}
                {owner ? (
                  <Action
                    label="Alterar papel"
                    disabled={state.busy}
                    onPress={() => {
                      setTargetRole(member.role);
                      setDialog("role");
                    }}
                  />
                ) : null}
                {member.userId === context.actorId ? (
                  <Action
                    label="Sair da residência"
                    onPress={() => setDialog("leave")}
                  />
                ) : owner ? (
                  <Action
                    label="Remover membro"
                    disabled={state.busy || locked}
                    onPress={() => setDialog("remove")}
                  />
                ) : null}
              </View>
            ) : (
              <Text style={s.body}>
                Selecione um participante para conhecer seu papel e as ações
                disponíveis.
              </Text>
            )}
          </>
        ) : null}
        {tab === "invites" && owner ? (
          <View style={s.card}>
            <Text style={s.heading}>Convites da residência</Text>
            <Text style={s.body}>
              O código dá acesso como membro por 24 horas. Compartilhe apenas
              com a pessoa que vai participar. Gerar outro código revoga os
              pendentes anteriores.
            </Text>
            <Action
              primary
              label="Gerar convite"
              disabled={
                state.busy || context.members.length >= context.maximumMembers
              }
              onPress={() => setDialog("invite")}
            />
            {context.members.length >= context.maximumMembers ? (
              <Text>As duas vagas estão ocupadas.</Text>
            ) : null}
            {state.code ? (
              <View style={s.notice}>
                <Text style={s.heading}>Convite pronto</Text>
                <Text>
                  Válido até{" "}
                  {new Date(state.code.expiresAt).toLocaleString("pt-BR")}
                </Text>
                <TextInput
                  accessibilityLabel="Código do convite: selecione e copie"
                  editable={false}
                  selectTextOnFocus
                  value={state.code.code}
                  style={s.input}
                />
                <Action
                  label="Copiar código"
                  onPress={async () => {
                    try {
                      await Clipboard.setStringAsync(state.code!.code);
                      setCopyNotice("Código copiado.");
                    } catch {
                      setCopyNotice(
                        "Toque e segure no código para copiar manualmente.",
                      );
                    }
                  }}
                />
                <Action
                  label="Compartilhar código"
                  onPress={async () => {
                    try {
                      await Share.share({ message: state.code!.code });
                      setCopyNotice(
                        "Use a opção copiar no compartilhamento ou selecione o código acima.",
                      );
                    } catch {
                      setCopyNotice(
                        "Selecione o código acima para copiar manualmente.",
                      );
                    }
                  }}
                />
                <Text selectable style={s.code}>
                  {state.code.code}
                </Text>
                <Text style={s.muted}>Toque e segure para copiar.</Text>
                <Action label="Ocultar código" onPress={state.clearCode} />
                <Text accessibilityLiveRegion="polite">{copyNotice}</Text>
              </View>
            ) : null}
            {state.invitations.map((i) => (
              <View key={i.id} style={s.invitation}>
                <Text style={s.heading}>{invitationStatus(i)}</Text>
                <Text style={s.muted}>
                  Criado em {new Date(i.createdAt).toLocaleString("pt-BR")}
                </Text>
                <Text style={s.muted}>
                  Validade até {new Date(i.expiresAt).toLocaleString("pt-BR")}
                </Text>
                {invitationStatus(i) === "Pendente" ? (
                  <Action
                    label="Revogar"
                    disabled={state.busy}
                    onPress={() => {
                      setInviteId(i.id);
                      setDialog("revoke");
                    }}
                  />
                ) : null}
              </View>
            ))}
            <Text style={s.muted}>
              {state.invitations.length
                ? "Até 50 convites recentes. Códigos antigos não são recuperáveis."
                : "Ainda não há convites."}
            </Text>
          </View>
        ) : null}
      </ScrollView>
      <Modal
        visible={Boolean(dialog && (dialog === "leave" || owner))}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!state.busy) setDialog(null);
        }}
      >
        <View style={s.overlay}>
          <ScrollView contentContainerStyle={s.modal} accessibilityViewIsModal>
            <Image
              source={require("../../assets/pipo-household.png")}
              style={s.dialogArt}
              resizeMode="contain"
              accessibilityLabel="Pipo cuida das portas do lar"
            />
            <Text style={s.title}>
              {dialog === "role"
                ? "Confirmar alteração de papel"
                : dialog === "remove"
                  ? "Remover participante?"
                  : dialog === "leave"
                    ? "Sair desta residência?"
                    : dialog === "revoke"
                      ? "Revogar convite?"
                      : "Convidar alguém para o Ninho"}
            </Text>
            {dialog === "role" && member ? (
              <>
                <Text>Papel de {memberLabel(member, context.actorId)}</Text>
                <Action
                  label="Membro"
                  selected={targetRole === "member"}
                  disabled={state.busy}
                  onPress={() => setTargetRole("member")}
                />
                <Action
                  label="Responsável"
                  selected={targetRole === "owner"}
                  disabled={state.busy}
                  onPress={() => setTargetRole("owner")}
                />
                <Text style={s.body}>{roleCopy[targetRole]}</Text>
                {locked && targetRole !== "owner" ? (
                  <Text accessibilityRole="alert" style={s.notice}>
                    O último responsável não pode perder esse papel.
                  </Text>
                ) : null}
              </>
            ) : dialog === "remove" || dialog === "leave" ? (
              <>
                <Text style={s.body}>
                  {dialog === "leave"
                    ? "Você perderá"
                    : "O participante perderá"}{" "}
                  acesso às finanças. Os registros e sua autoria histórica serão
                  preservados. Outras residências não são afetadas.
                </Text>
                {(
                  dialog === "leave"
                    ? lastOwner(
                        context,
                        context.members.find(
                          (m) => m.userId === context.actorId,
                        )!,
                      )
                    : locked
                ) ? (
                  <Text style={s.notice}>
                    Antes, convide outro participante e torne-o responsável. O
                    último responsável precisa permanecer.
                  </Text>
                ) : null}
              </>
            ) : dialog === "revoke" ? (
              <Text style={s.body}>
                O código deixará de permitir novas entradas. Quem já entrou não
                será removido.
              </Text>
            ) : (
              <Text style={s.body}>
                Código de uso único válido por 24 horas para entrar como membro.
                Um novo código substitui os convites pendentes anteriores.
              </Text>
            )}
            <Action
              primary
              label={state.busy ? "Confirmando…" : "Confirmar"}
              disabled={
                state.busy ||
                (dialog === "role" &&
                  (targetRole === member?.role ||
                    (locked && targetRole !== "owner"))) ||
                (dialog === "remove" && locked) ||
                (dialog === "leave" &&
                  lastOwner(
                    context,
                    context.members.find((m) => m.userId === context.actorId)!,
                  ))
              }
              onPress={confirmation}
            />
            <Action
              label="Cancelar"
              disabled={state.busy}
              onPress={() => setDialog(null)}
            />
            {state.notice ? (
              <Text accessibilityRole="alert" style={s.notice}>
                {state.notice}
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
function Action({
  label,
  onPress,
  disabled = false,
  selected = false,
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
export function AccessRemoved() {
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <Image
          source={require("../../assets/pipo-household-path.png")}
          style={s.art}
          resizeMode="contain"
          accessibilityLabel="Pipo indica um novo caminho acolhedor"
        />
        <Text style={s.title}>Este Ninho não está mais disponível</Text>
        <Text style={s.body}>
          Sua participação foi encerrada ou o acesso mudou. A visualização
          anterior foi fechada. Os registros e sua autoria continuam
          preservados.
        </Text>
        <Action
          primary
          label="Escolher residência autorizada"
          onPress={() => router.replace("/selecionar-residencia")}
        />
        <Action
          label="Escolher como continuar"
          onPress={() => router.replace("/comecar")}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.cream },
  content: { padding: 22, gap: 14, paddingBottom: 40 },
  title: {
    fontFamily: t.serif,
    fontSize: 28,
    color: "#244735",
    marginVertical: 8,
  },
  heading: { fontFamily: t.serif, fontSize: 20, color: "#244735" },
  eyebrow: { fontFamily: t.sans, fontSize: 12, color: "#62774d" },
  body: {
    fontFamily: t.sans,
    color: t.muted,
    lineHeight: 23,
    marginVertical: 8,
  },
  muted: { fontFamily: t.sans, fontSize: 12, color: t.muted, lineHeight: 19 },
  art: { width: "100%", height: 210 },
  dialogArt: { width: 200, height: 135, alignSelf: "center" },
  card: {
    padding: 22,
    gap: 8,
    backgroundColor: "#fffdf5",
    borderWidth: 1,
    borderColor: "#e4dbc5",
    borderRadius: 22,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: {
    minHeight: 44,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ded7bf",
    backgroundColor: "#fffdf5",
    justifyContent: "center",
  },
  buttonText: { fontFamily: t.sans, color: "#244735" },
  selected: { backgroundColor: "#355d41", borderColor: "#355d41" },
  notice: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#f2ead1",
    color: "#5b492b",
    lineHeight: 23,
  },
  invitation: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#ded7bf",
    gap: 8,
  },
  input: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#ded7bf",
    borderRadius: 12,
    marginVertical: 10,
    color: "#244735",
  },
  code: { fontSize: 14, color: "#244735", marginVertical: 12 },
  overlay: {
    flex: 1,
    backgroundColor: "#172a2566",
    padding: 20,
    justifyContent: "center",
  },
  modal: { backgroundColor: t.cream, borderRadius: 24, padding: 24, gap: 14 },
});
