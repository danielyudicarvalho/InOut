"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { authMessage } from "@inout/identity";
import { getAuth, pendingEmail, rememberEmail } from "./composition";
const subscribeToStoredEmail = () => () => {};
export function useConfirmation(initial: "pending" | "confirmed" | "invalid") {
  const [state, setState] = useState<"pending" | "confirmed" | "invalid">(
    initial === "confirmed" ? "pending" : initial,
  );
  const storedEmail = useSyncExternalStore(
    subscribeToStoredEmail,
    pendingEmail,
    () => "",
  );
  const [editedEmail, setEmail] = useState<string | null>(null);
  const email = editedEmail ?? storedEmail;
  const [token, setToken] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [retryAt, setRetryAt] = useState(0);
  useEffect(() => {
    if (initial !== "confirmed") return;
    let active = true;
    Promise.resolve()
      .then(() => getAuth().currentUser())
      .then((user) => {
        if (active) setState(user?.emailConfirmed ? "confirmed" : "invalid");
      })
      .catch((error) => {
        if (active) {
          setState("invalid");
          setNotice(authMessage(error));
        }
      });
    return () => {
      active = false;
    };
  }, [initial]);
  async function act(kind: "resend" | "confirm") {
    if (running.current) return;
    if (kind === "resend" && Date.now() < retryAt) {
      setNotice("Aguarde um minuto antes de reenviar.");
      return;
    }
    running.current = true;
    setBusy(true);
    setNotice("");
    try {
      const auth = getAuth();
      if (kind === "resend") {
        await auth.resend(email);
        rememberEmail(email);
        setRetryAt(Date.now() + 60000);
        setNotice(
          "Se o cadastro estiver pendente, você receberá um novo e-mail.",
        );
      } else {
        await auth.confirm(email, token);
        const user = await auth.currentUser();
        if (!user?.emailConfirmed) throw new Error("confirmation");
        setToken("");
        setState("confirmed");
      }
    } catch (error) {
      setNotice(authMessage(error));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return { state, email, setEmail, token, setToken, notice, busy, act };
}
