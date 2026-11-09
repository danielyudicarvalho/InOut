"use client";
import { BrandLogo, Button, Input } from "../ui";
import { useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authMessage } from "@inout/identity";
import { getAuth, rememberEmail } from "../../lib/auth/composition";
import Image from "next/image";
import Link from "next/link";
import {
  EnvelopeSimple,
  LockSimple,
  Eye,
  EyeSlash,
  CaretRight,
} from "@phosphor-icons/react";
export function LoginScreen() {
  const [visible, setVisible] = useState(false);
  const [notice, setNotice] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams?.get("next");
  const validNext =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : null;

  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email"));
    running.current = true;
    setBusy(true);
    setNotice("");
    try {
      await getAuth().signIn({ email, password: String(data.get("password")) });
      rememberEmail(email);
      if (validNext) {
        router.replace(validNext);
      } else {
        router.replace("/preparando");
      }
    } catch (error) {
      rememberEmail(email);
      setNotice(authMessage(error));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="signin">
      <section className="signin-art" aria-label="Seu ninho está esperando">
        <Image
          src="/images/pipo-home.webp"
          alt="Pipo em um ambiente acolhedor entre plantas"
          fill
          priority
          sizes="(max-width: 760px) 100vw, 55vw"
        />
        <div className="signin-art-copy">
          <Link href="/" className="brand">
            <BrandLogo />
          </Link>
          <h1>
            Bom ter
            <br />
            você de volta.
          </h1>
          <p>Seu ninho está te esperando.</p>
        </div>
      </section>
      <section className="signin-panel">
        <Link href="/" className="brand">
          <BrandLogo />
        </Link>
        <div className="signin-form">
          <h2>
            <span className="signin-desktop-title">Entrar</span>
            <span className="signin-mobile-title">
              Bom ter
              <br />
              você de volta.
            </span>
          </h2>
          <p>Acesse seu cantinho financeiro.</p>
          <form method="post" onSubmit={submit}>
            <Input
              id="email"
              label="E-mail"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="voce@exemplo.com"
              required
              iconStart={<EnvelopeSimple size={21} />}
            />
            <Input
              id="password"
              label="Senha"
              name="password"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              required
              iconStart={<LockSimple size={21} />}
              trailing={
                <button
                  type="button"
                  aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? (
                    <EyeSlash size={21} aria-hidden="true" />
                  ) : (
                    <Eye size={21} aria-hidden="true" />
                  )}
                </button>
              }
            />
            <Link href="/esqueci-senha" className="signin-forgot">
              Esqueci minha senha
            </Link>
            <Button
              type="submit"
              className="signin-submit"
              loading={busy}
              disabled={busy}
              iconEnd={<CaretRight size={20} />}
            >
              {busy ? "Entrando…" : "Entrar"}
            </Button>
            <p role="status" className="signin-notice">
              {notice}
            </p>
          </form>
          <Link href="/confirmar-email" className="signin-back">
            Confirmar meu e-mail
          </Link>
          <div className="signin-divider">
            <span>Ainda não tem conta?</span>
          </div>
          <Link href="/criar-conta" className="signin-register">
            Criar conta
          </Link>
          <Link href="/" className="signin-back">
            Voltar ao início
          </Link>
        </div>
      </section>
    </main>
  );
}
