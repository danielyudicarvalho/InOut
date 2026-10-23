"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authMessage } from "@inout/identity";
import { getAuth } from "../lib/auth/composition";
let exchange: { code: string; result: Promise<void> } | undefined;
export function AuthCallbackScreen() {
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
    window.history.replaceState(null, "", "/auth/callback");
    if (!code || error) {
      router.replace("/link-invalido");
      return;
    }
    if (exchange?.code !== code)
      exchange = {
        code,
        result: (async () => {
          const auth = getAuth();
          await auth.exchangeCode(code);
          const user = await auth.currentUser();
          if (!user?.emailConfirmed) throw new Error("confirmation");
        })(),
      };
    exchange.result
      .then(() => {
        if (active) router.replace("/email-confirmado");
      })
      .catch((error) => {
        if (active)
          setNotice(
            authMessage(error) +
              " Você pode entrar ou confirmar com o código recebido por e-mail.",
          );
      });
    return () => {
      active = false;
    };
  }, [router]);
  return (
    <main className="invitation-result">
      <section className="invitation-result-content">
        <h1>Confirmação de e-mail</h1>
        <p role="status">{notice}</p>
        <Link href="/confirmar-email">Confirmar com código</Link>
        <Link className="signin-back" href="/entrar">
          Ir para entrar
        </Link>
      </section>
    </main>
  );
}
