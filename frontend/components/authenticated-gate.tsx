"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authMessage, type AuthUser } from "@inout/identity";
import { getAuth } from "../lib/auth/composition";
export function AuthenticatedGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [notice, setNotice] = useState("Restaurando seu acesso…");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => getAuth().currentUser())
      .then((value) => {
        if (!active) return;
        if (!value?.emailConfirmed) {
          router.replace("/entrar");
          return;
        }
        setUser(value);
        setNotice("");
      })
      .catch((error) => {
        if (active) {
          setUser(null);
          setNotice(authMessage(error));
        }
      });
    return () => {
      active = false;
    };
  }, [revision, router]);
  useEffect(() => {
    try {
      const unsubscribe = getAuth().subscribe(() => {
        setUser(null);
        setRevision((value) => value + 1);
      });
      return unsubscribe;
    } catch {
      return;
    }
  }, []);
  if (!user)
    return (
      <main className="invitation-result">
        <section className="invitation-result-content">
          <p role="status">{notice}</p>
          <Link href="/entrar">Ir para entrar</Link>
          <button
            className="account-text-button"
            onClick={() => setRevision((value) => value + 1)}
          >
            Tentar novamente
          </button>
        </section>
      </main>
    );
  return <>{children}</>;
}
