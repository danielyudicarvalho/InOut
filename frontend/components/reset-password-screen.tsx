"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Plant,
  LockSimple,
  Eye,
  EyeSlash,
  ArrowLeft,
  CheckCircle,
} from "@phosphor-icons/react";

export function ResetPasswordScreen() {
  const [visible, setVisible] = useState({
    password: false,
    confirmation: false,
  });
  const [notice, setNotice] = useState("");
  const [complete, setComplete] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (data.get("password") !== data.get("confirmation")) {
      setNotice("As senhas precisam ser iguais.");
      return;
    }
    form.reset();
    setVisible({ password: false, confirmation: false });
    setNotice("");
    setComplete(true);
  }
  return (
    <main className="signin recovery">
      <section
        className="signin-art"
        aria-label="Um novo começo, com segurança"
      >
        <Image
          src="/images/pipo-home.webp"
          alt="Pipo em seu ninho entre plantas"
          fill
          priority
          sizes="(max-width: 760px) 100vw, 55vw"
        />
        <div className="signin-art-copy">
          <Link href="/" className="brand">
            <Plant size={30} weight="duotone" />
            ninho
          </Link>
          <h1>
            Um novo começo,
            <br />
            com segurança.
          </h1>
        </div>
      </section>
      <section className="signin-panel">
        <Link href="/" className="brand">
          <Plant size={30} weight="duotone" />
          ninho
        </Link>
        <div className="signin-form">
          <h1 className="confirmation-title">
            {complete ? "Senha alterada!" : "Definir nova senha"}
          </h1>
          {complete ? (
            <div role="status">
              <CheckCircle size={38} color="#35502a" aria-hidden="true" />
              <p className="recovery-copy">
                Prévia da conclusão. Entre no Ninho para continuar.
              </p>
            </div>
          ) : (
            <>
              <p className="recovery-copy">
                Escolha uma nova senha para
                <br />
                acessar seu Ninho.
              </p>
              <form onSubmit={submit} onChange={() => setNotice("")}>
                {(["password", "confirmation"] as const).map((field) => (
                  <div key={field}>
                    <label htmlFor={field}>
                      {field === "password"
                        ? "Nova senha"
                        : "Confirmar nova senha"}
                    </label>
                    <div className="signin-input">
                      <LockSimple size={21} aria-hidden="true" />
                      <input
                        id={field}
                        name={field}
                        type={visible[field] ? "text" : "password"}
                        placeholder={
                          field === "password"
                            ? "Digite sua nova senha"
                            : "Repita sua nova senha"
                        }
                        autoComplete="new-password"
                        required
                        minLength={8}
                        aria-describedby="reset-help"
                      />
                      <button
                        type="button"
                        aria-label={`${visible[field] ? "Ocultar" : "Mostrar"} ${field === "password" ? "nova senha" : "confirmação de senha"}`}
                        aria-pressed={visible[field]}
                        onClick={() =>
                          setVisible({ ...visible, [field]: !visible[field] })
                        }
                      >
                        {visible[field] ? (
                          <EyeSlash size={21} />
                        ) : (
                          <Eye size={21} />
                        )}
                      </button>
                    </div>
                    {field === "password" && (
                      <p id="reset-help" className="register-help">
                        Use uma senha forte e exclusiva, com pelo menos 8
                        caracteres.
                      </p>
                    )}
                  </div>
                ))}
                <p role="alert" className="signin-notice">
                  {notice}
                </p>
                <button
                  type="submit"
                  className="primary signin-submit recovery-submit"
                >
                  Salvar nova senha
                </button>
              </form>
            </>
          )}
          <p className="recovery-preview">
            Prévia de interface. Nenhuma senha foi alterada. A validação do link
            e a atualização da senha ainda não estão integradas.
          </p>
          <Link
            href="/entrar"
            className={complete ? "primary" : "signin-back recovery-back"}
          >
            {!complete && <ArrowLeft size={18} aria-hidden="true" />}
            {complete ? "Ir para entrar" : "Voltar para entrar"}
          </Link>
          {complete && (
            <button
              className="confirmation-resend"
              onClick={() => setComplete(false)}
            >
              Rever formulário
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
