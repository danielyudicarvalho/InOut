"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authMessage } from "@inout/identity";
import { getAuth } from "../../lib/auth/composition";
let exchange:
  { code: string; recovery: boolean; result: Promise<void> } | undefined;
export function AuthCallbackScreen({
  recovery = false,
}: {
  recovery?: boolean;
}) {
  const callback = useRef<{ code: string | null; error: boolean } | null>(null);
  const router = useRouter();
  const [notice, setNotice] = useState("Confirmando seu acesso…");
  useEffect(() => {
    let active = true;
    if (!callback.current) {
      const params = new URLSearchParams(window.location.search);
      callback.current = {
        code: params.get("code"),
        error: params.has("error"),
      };
    }
    const { code, error } = callback.current;
    window.history.replaceState(
      null,
      "",
      recovery ? "/auth/recuperar" : "/auth/callback",
    );
    if (!code || error) {
      router.replace(recovery ? "/redefinir-senha" : "/link-invalido");
      return;
    }
    if (exchange?.code !== code || exchange.recovery !== recovery)
      exchange = {
        code,
        recovery,
        result: (async () => {
          const auth = getAuth();
          if (recovery) {
            await auth.exchangeRecoveryCode(code);
            return;
          }
          await auth.exchangeCode(code);
          const user = await auth.currentUser();
          if (!user?.emailConfirmed) throw new Error("confirmation");
        })(),
      };
    exchange.result
      .then(() => {
        if (active)
          router.replace(recovery ? "/redefinir-senha" : "/email-confirmado");
      })
      .catch((error) => {
        if (active)
          setNotice(
            authMessage(error) +
              (recovery
                ? " Solicite um novo link e abra-o neste mesmo navegador."
                : " Você pode entrar ou confirmar com o código recebido por e-mail."),
          );
      });
    return () => {
      active = false;
    };
  }, [router, recovery]);
  return (
    <main className="invitation-result">
      <section className="invitation-result-content">
        <h1>{recovery ? "Recuperação de senha" : "Confirmação de e-mail"}</h1>
        <p role="status">{notice}</p>
        <Link href={recovery ? "/esqueci-senha" : "/confirmar-email"}>
          {recovery ? "Solicitar novo link" : "Confirmar com código"}
        </Link>
        <Link className="signin-back" href="/entrar">
          Ir para entrar
        </Link>
      </section>
    </main>
  );
}
