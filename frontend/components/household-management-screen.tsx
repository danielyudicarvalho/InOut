"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  roleLabel,
  memberLabel,
  lastOwner,
  invitationStatus,
  type HouseholdMember,
  type HouseholdRole,
} from "@inout/finance/collaboration";
import { useCollaboration } from "../lib/finance/use-collaboration";
import "./accounts.css";
import "./catalog.css";
import "./household-management.css";
const roleCopy = {
  owner:
    "Compartilha todas as finanças e também pode gerar e revogar convites, alterar papéis e remover participantes. Deve haver ao menos um responsável.",
  member:
    "Compartilha as contas e os lançamentos da residência. Pode registrar movimentações e sair da residência. Não gerencia participantes nem convites.",
};
export function HouseholdManagementScreen({
  choose = false,
}: {
  choose?: boolean;
}) {
  const p = useSearchParams();
  const id = choose ? "" : (p.get("household") ?? "");
  return <HouseholdView key={id} initial={id} />;
}
function HouseholdView({ initial }: { initial: string }) {
  const state = useCollaboration(initial),
    router = useRouter();
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
  const url = (path: string) =>
    `${path}?${new URLSearchParams({ household: state.household })}`;
  const select = (id: string) => {
    setSelected("");
    setDialog(null);
    setCopyNotice("");
    state.select(id);
    router.replace(`/residencia?${new URLSearchParams({ household: id })}`);
  };
  if (state.status === "removed") return <AccessRemoved />;
  if (state.loading)
    return (
      <main className="financial-state">
        <h1>Minha residência</h1>
        <p role="status">Abrindo as portas do seu Ninho…</p>
      </main>
    );
  if (state.status === "error")
    return (
      <main className="financial-state">
        <h1>Não foi possível carregar a residência</h1>
        <p role="alert">{state.notice}</p>
        <button onClick={state.retry}>Tentar novamente</button>
        <Link href="/selecionar-residencia">Escolher residência</Link>
      </main>
    );
  if (state.status === "choose" || !context)
    return (
      <main className="household-choice-page accounts-page">
        <Image
          src="/images/pipo-household.png"
          width={360}
          height={220}
          alt="Pipo recebe você em uma casa acolhedora"
        />
        <h1>Qual Ninho vamos abrir?</h1>
        <p>Você acessa apenas as residências das quais participa.</p>
        <div className="catalog-list">
          {state.homes.map((home) => (
            <button
              key={home.id}
              className="account-card"
              onClick={() => select(home.id)}
            >
              {home.name} →
            </button>
          ))}
        </div>
        {!state.homes.length ? (
          <p>Você ainda não participa de uma residência.</p>
        ) : null}
        <Link href="/criar-residencia">Criar residência</Link>
        <Link href="/entrar-convite">Usar um convite</Link>
      </main>
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
    <main className="dashboard accounts-page">
      <aside className="dashboard-sidebar">
        <Link className="dashboard-brand" href={url("/inicio")}>
          🌿 Ninho
        </Link>
        <nav>
          <Link href={url("/inicio")}>Início</Link>
          <Link href={url("/contas")}>Contas</Link>
          <strong aria-current="page">Minha residência</strong>
          <Link href="/selecionar-residencia">Trocar residência</Link>
        </nav>
      </aside>
      <div className="dashboard-body">
        <header className="dashboard-topbar">
          <label>
            Residência atual{" "}
            <select
              value={state.household}
              disabled={state.busy}
              onChange={(e) => select(e.target.value)}
            >
              {state.homes.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
        </header>
        <section className="accounts-hero">
          <div>
            <Link href={url("/inicio")}>‹ Início</Link>
            <p className="catalog-eyebrow">Um lar que cuidamos juntos</p>
            <h1>{context.name}</h1>
            <p>
              Seu papel: <strong>{roleLabel(context.role)}</strong> ·{" "}
              {context.members.length}/{context.maximumMembers} participantes
            </p>
          </div>
          <Image
            src="/images/pipo-household.png"
            width={360}
            height={250}
            alt="Pipo e um amigo acolhem você no Ninho"
          />
        </section>
        <div
          className="accounts-toolbar"
          role="group"
          aria-label="Gestão da residência"
        >
          <button aria-pressed={tab === "home"} onClick={() => setTab("home")}>
            Minha residência
          </button>
          <button
            aria-pressed={tab === "members"}
            onClick={() => setTab("members")}
          >
            Membros
          </button>
          {owner ? (
            <button
              aria-pressed={tab === "invites"}
              onClick={() => setTab("invites")}
            >
              Convites
            </button>
          ) : null}
          <button disabled={state.busy} onClick={state.retry}>
            Atualizar
          </button>
        </div>
        {state.notice ? (
          <p role="status" className="accounts-notice">
            {state.notice}
          </p>
        ) : null}
        {tab === "home" || (tab === "invites" && !owner) ? (
          <section className="account-card">
            <h2>Um contexto compartilhado</h2>
            <p>
              Contas, categorias, fontes de renda e movimentações pertencem a
              esta residência. Os participantes compartilham esses registros;
              não há acompanhamento individual de hábitos financeiros nesta
              área.
            </p>
            <p>{roleCopy[context.role]}</p>
            <p>
              Limite atual: dois participantes. É possível participar de mais de
              uma residência e alternar entre elas.
            </p>
            <div className="account-actions">
              <button onClick={() => setTab("members")}>
                Gerenciar membros
              </button>
              {owner ? (
                <button
                  disabled={
                    state.busy ||
                    context.members.length >= context.maximumMembers
                  }
                  onClick={() => setDialog("invite")}
                >
                  Convidar membro
                </button>
              ) : null}
              <button onClick={() => setDialog("leave")} disabled={state.busy}>
                Sair da residência
              </button>
            </div>
          </section>
        ) : null}
        {tab === "members" ? (
          <div className="catalog-layout">
            <section className="catalog-list">
              {context.members.map((m) => (
                <button
                  className="account-card household-member"
                  key={m.userId}
                  aria-expanded={selected === m.userId}
                  onClick={() => chooseMember(m)}
                >
                  <span className="household-avatar" aria-hidden="true">
                    ⌂
                  </span>
                  <strong>{memberLabel(m, context.actorId)}</strong>
                  <small>{roleLabel(m.role)} · Ativo</small>
                  <small>
                    Desde {new Date(m.joinedAt).toLocaleDateString("pt-BR")}
                  </small>
                </button>
              ))}
            </section>
            <section className="account-card">
              {member ? (
                <>
                  <p className="catalog-eyebrow">Detalhe do membro</p>
                  <h2>{memberLabel(member, context.actorId)}</h2>
                  <p>{roleLabel(member.role)} · Ativo</p>
                  <p className="household-identifier">
                    Identificação: {member.userId}
                  </p>
                  <p>{roleCopy[member.role]}</p>
                  <p>
                    Esta área exibe participação e acesso. Não mostra gastos,
                    rankings ou atividade individual do participante.
                  </p>
                  {locked ? (
                    <p className="accounts-notice">
                      Último responsável. Promova outro participante antes de
                      alterar este papel ou encerrar a participação.
                    </p>
                  ) : null}
                  <div className="account-actions">
                    {owner ? (
                      <button
                        disabled={state.busy}
                        onClick={() => {
                          setTargetRole(member.role);
                          setDialog("role");
                        }}
                      >
                        Alterar papel
                      </button>
                    ) : null}
                    {member.userId === context.actorId ? (
                      <button
                        disabled={state.busy}
                        onClick={() => setDialog("leave")}
                      >
                        Sair da residência
                      </button>
                    ) : owner ? (
                      <button
                        disabled={state.busy || locked}
                        onClick={() => setDialog("remove")}
                      >
                        Remover membro
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <h2>Quem cuida deste Ninho?</h2>
                  <p>
                    Selecione um participante para conhecer seu papel e as ações
                    disponíveis.
                  </p>
                </>
              )}
            </section>
          </div>
        ) : null}
        {tab === "invites" && owner ? (
          <section className="account-card">
            <h2>Convites da residência</h2>
            <p>
              O código dá acesso como membro e vale por 24 horas. Guarde-o com
              cuidado e compartilhe apenas com quem vai participar. Gerar outro
              código revoga os convites pendentes anteriores.
            </p>
            <button
              className="primary"
              disabled={
                state.busy || context.members.length >= context.maximumMembers
              }
              onClick={() => setDialog("invite")}
            >
              Gerar convite
            </button>
            {context.members.length >= context.maximumMembers ? (
              <p>As duas vagas estão ocupadas.</p>
            ) : null}
            {state.code ? (
              <section className="accounts-notice">
                <h3>Convite pronto</h3>
                <p>
                  Válido até{" "}
                  {new Date(state.code.expiresAt).toLocaleString("pt-BR")}
                </p>
                <label>
                  Código do convite
                  <input
                    readOnly
                    value={state.code.code}
                    className="household-code"
                    onFocus={(e) => e.target.select()}
                  />
                </label>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(state.code!.code);
                      setCopyNotice("Código copiado.");
                    } catch {
                      setCopyNotice(
                        "Não foi possível copiar. Selecione o código e copie manualmente.",
                      );
                    }
                  }}
                >
                  Copiar código
                </button>
                <button onClick={state.clearCode}>Ocultar código</button>
                <p role="status">{copyNotice}</p>
              </section>
            ) : null}
            <ul className="household-invitations">
              {state.invitations.map((i) => (
                <li key={i.id}>
                  <div>
                    <strong>{invitationStatus(i)}</strong>
                    <p>
                      Criado em {new Date(i.createdAt).toLocaleString("pt-BR")}
                    </p>
                    <small>
                      Validade até{" "}
                      {new Date(i.expiresAt).toLocaleString("pt-BR")}
                    </small>
                  </div>
                  {invitationStatus(i) === "Pendente" ? (
                    <button
                      disabled={state.busy}
                      onClick={() => {
                        setInviteId(i.id);
                        setDialog("revoke");
                      }}
                    >
                      Revogar
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {!state.invitations.length ? (
              <p>
                Ainda não há convites. São exibidos os 50 convites mais
                recentes.
              </p>
            ) : (
              <small>
                Até 50 convites recentes. Códigos antigos não são recuperáveis;
                só a situação é exibida.
              </small>
            )}
          </section>
        ) : null}
        {dialog && (dialog === "leave" || owner) ? (
          <ConfirmDialog busy={state.busy} onClose={() => setDialog(null)}>
            <Image
              className="accounts-dialog-art"
              src="/images/pipo-household.png"
              width={200}
              height={145}
              alt="Pipo cuida das portas do lar"
            />
            <h2 id="household-confirm-title">
              {dialog === "role"
                ? "Confirmar alteração de papel"
                : dialog === "remove"
                  ? "Remover participante?"
                  : dialog === "leave"
                    ? "Sair desta residência?"
                    : dialog === "revoke"
                      ? "Revogar este convite?"
                      : "Convidar alguém para o Ninho"}
            </h2>
            {dialog === "role" && member ? (
              <>
                <label>
                  Papel de {memberLabel(member, context.actorId)}
                  <select
                    value={targetRole}
                    disabled={state.busy}
                    onChange={(e) =>
                      setTargetRole(e.target.value as HouseholdRole)
                    }
                  >
                    <option value="member">Membro</option>
                    <option value="owner">Responsável</option>
                  </select>
                </label>
                <p>{roleCopy[targetRole]}</p>
                {locked && targetRole !== "owner" ? (
                  <p role="alert">
                    O último responsável não pode perder esse papel.
                  </p>
                ) : null}
              </>
            ) : dialog === "remove" || dialog === "leave" ? (
              <>
                <p>
                  {dialog === "leave"
                    ? "Você perderá"
                    : "O participante perderá"}{" "}
                  o acesso às finanças desta residência. Os lançamentos e sua
                  autoria histórica serão preservados. Outras residências não
                  são afetadas.
                </p>
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
                  <p role="alert">
                    Antes, convide outro participante e torne-o responsável. O
                    último responsável precisa permanecer.
                  </p>
                ) : null}
              </>
            ) : dialog === "revoke" ? (
              <p>
                O código deixará de permitir novas entradas. Quem já aceitou um
                convite não será removido.
              </p>
            ) : (
              <p>
                Será gerado um código de uso único, válido por 24 horas, para
                entrar como membro com acesso às finanças compartilhadas. Um
                novo código substitui os convites pendentes anteriores.
              </p>
            )}
            <div className="account-actions">
              <button disabled={state.busy} onClick={() => setDialog(null)}>
                Cancelar
              </button>
              <button
                className="primary"
                disabled={
                  state.busy ||
                  (dialog === "role" &&
                    (targetRole === member?.role ||
                      (locked && targetRole !== "owner"))) ||
                  (dialog === "remove" && locked) ||
                  (dialog === "leave" &&
                    lastOwner(
                      context,
                      context.members.find(
                        (m) => m.userId === context.actorId,
                      )!,
                    ))
                }
                onClick={confirmation}
              >
                {state.busy ? "Confirmando…" : "Confirmar"}
              </button>
            </div>
            {state.notice ? <p role="alert">{state.notice}</p> : null}
          </ConfirmDialog>
        ) : null}
      </div>
    </main>
  );
}
function ConfirmDialog({
  children,
  busy,
  onClose,
}: {
  children: React.ReactNode;
  busy: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="accounts-dialog"
      aria-labelledby="household-confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
export function AccessRemoved() {
  return (
    <main className="household-choice-page accounts-page">
      <Image
        src="/images/pipo-household-path.png"
        width={340}
        height={230}
        alt="Pipo indica um novo caminho acolhedor"
      />
      <h1>Este Ninho não está mais disponível</h1>
      <p>
        Sua participação foi encerrada ou o acesso mudou. A visualização
        anterior foi fechada. Os registros e sua autoria continuam preservados.
      </p>
      <Link className="primary" href="/selecionar-residencia">
        Escolher uma residência autorizada
      </Link>
      <Link href="/comecar">Escolher como continuar</Link>
    </main>
  );
}
