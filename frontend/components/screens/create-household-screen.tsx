"use client";
import { BrandLogo } from "../ui/brand-logo";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authMessage } from "@inout/identity";
import { getAuth } from "../../lib/auth/composition";
import {
  Plant,
  House,
  Coins,
  Clock,
  ArrowLeft,
  SignOut,
} from "@phosphor-icons/react";

export function CreateHouseholdScreen() {
  const [notice, setNotice] = useState("");
  const [exitBusy, setExitBusy] = useState(false);
  const router = useRouter();
  async function signOut() {
    if (exitBusy) return;
    setExitBusy(true);
    setNotice("");
    try {
      await getAuth().signOut();
      router.replace("/entrar");
    } catch (error) {
      setNotice(authMessage(error));
    } finally {
      setExitBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    if (!name || name.length > 80) {
      setNotice("Informe um nome de 1 a 80 caracteres.");
      return;
    }
    setNotice(
      "Configurações conferidas. A criação da residência ainda não está integrada; nenhum dado foi salvo.",
    );
  }
  return (
    <main className="household-choice create-household">
      <header className="household-header">
        <Link href="/" className="brand">
          <BrandLogo />
        </Link>
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={exitBusy}
          className="household-exit auth-exit"
        >
          {exitBusy ? "Saindo…" : "Sair"}
          <SignOut size={22} aria-hidden="true" />
        </button>
      </header>
      <Link href="/comecar" className="create-household-back">
        <ArrowLeft size={20} aria-hidden="true" />
        Voltar
      </Link>
      <div className="create-household-grid">
        <section className="create-household-story">
          <Image
            src="/images/pipo-create-residence-desktop.webp"
            className="create-residence-desktop-art"
            alt="Pipo construindo um ninho com um ramo, ao lado de uma casinha de telhado verde"
            width={520}
            height={420}
            preload
          />
          <Image
            src="/images/pipo-create-residence-mobile.webp"
            className="create-residence-mobile-art"
            alt="Pipo ao lado de uma casinha de telhado verde, cercados por flores e folhas"
            width={640}
            height={256}
            sizes="(max-width: 760px) 100vw, 1px"
          />
          <h1>Seu Ninho começa aqui.</h1>
          <p>
            Um espaço para organizar as finanças, sozinho ou com quem você
            escolher.
          </p>
        </section>
        <section
          className="create-household-panel"
          aria-labelledby="create-household-title"
        >
          <h2 id="create-household-title">Criar residência</h2>
          <p className="household-subtitle">
            Dê um nome ao seu espaço e confira as configurações iniciais.
          </p>
          <form onSubmit={submit} onChange={() => setNotice("")}>
            <fieldset disabled={exitBusy} className="create-household-fields">
              <label htmlFor="household-name">Nome da residência</label>
              <div className="signin-input">
                <House size={22} aria-hidden="true" />
                <input
                  id="household-name"
                  name="name"
                  defaultValue="Meu Ninho"
                  maxLength={80}
                  required
                  aria-describedby="household-name-help"
                />
              </div>
              <p id="household-name-help" className="register-help">
                Pode ser o nome da sua casa, família ou algo só seu.
              </p>
              <label htmlFor="household-currency">Moeda de referência</label>
              <div className="signin-input">
                <Coins size={22} aria-hidden="true" />
                <select
                  id="household-currency"
                  name="currency"
                  defaultValue="BRL"
                  aria-describedby="household-currency-help"
                >
                  <option value="BRL">Real brasileiro (BRL)</option>
                  <option value="USD">Dólar americano (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                </select>
              </div>
              <p id="household-currency-help" className="register-help">
                Usada nos resumos da residência.
              </p>
              <label htmlFor="household-timezone">Fuso horário</label>
              <div className="signin-input">
                <Clock size={22} aria-hidden="true" />
                <select
                  id="household-timezone"
                  name="timezone"
                  defaultValue="America/Cuiaba"
                  aria-describedby="household-timezone-help"
                >
                  <option value="America/Cuiaba">Cuiabá (UTC−04:00)</option>
                  <option value="America/Sao_Paulo">
                    São Paulo (UTC−03:00)
                  </option>
                  <option value="America/Manaus">Manaus (UTC−04:00)</option>
                  <option value="America/Rio_Branco">
                    Rio Branco (UTC−05:00)
                  </option>
                  <option value="America/Noronha">
                    Fernando de Noronha (UTC−02:00)
                  </option>
                </select>
              </div>
              <p id="household-timezone-help" className="register-help">
                Define as datas e os períodos dos relatórios.
              </p>
              <aside className="register-info">
                <Plant size={30} weight="duotone" aria-hidden="true" />
                <span>
                  Você pode começar sozinho e convidar pessoas depois.
                </span>
              </aside>
              <button type="submit" className="primary signin-submit">
                Criar residência
              </button>
            </fieldset>
            <p role="status" className="signin-notice">
              {notice}
            </p>
          </form>
          <Link href="/comecar" className="signin-back">
            Voltar
          </Link>
          <p className="household-preview">
            Prévia de interface. Nenhuma residência é criada.
          </p>
        </section>
      </div>
    </main>
  );
}
