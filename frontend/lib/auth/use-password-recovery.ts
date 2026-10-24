"use client";
import { useEffect, useRef, useState } from "react";
import { AuthFailure, authMessage } from "@inout/identity";
import { getAuth } from "./composition";
export function useRecoveryRequest() {
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const running = useRef(false);
  const retryAt = useRef(0);
  async function request(email: string) {
    if (running.current) return;
    if (Date.now() < retryAt.current) {
      setNotice("Aguarde um minuto antes de solicitar outro link.");
      return;
    }
    running.current = true;
    setBusy(true);
    setNotice("");
    try {
      await getAuth().requestPasswordReset(email);
      retryAt.current = Date.now() + 60000;
      setSubmitted(true);
    } catch (error) {
      setNotice(authMessage(error));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return { submitted, setSubmitted, busy, notice, setNotice, request };
}
export function usePasswordReset() {
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">(
    "checking",
  );
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const running = useRef(false);
  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => getAuth().canResetPassword())
      .then((valid) => {
        if (active) setStatus(valid ? "ready" : "invalid");
      })
      .catch((error) => {
        if (active) {
          setStatus("invalid");
          setNotice(authMessage(error));
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function reset(input: { password: string; confirmation: string }) {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setNotice("");
    try {
      const result = await getAuth().resetPassword(input);
      setComplete(true);
      if (result === "signOutRequired")
        setNotice(
          "A senha foi alterada, mas não foi possível encerrar a sessão. Tente sair novamente antes de entrar.",
        );
      return true;
    } catch (error) {
      if (
        error instanceof AuthFailure &&
        ["recovery_required", "session_missing"].includes(error.code)
      )
        setStatus("invalid");
      setNotice(authMessage(error));
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function signOut() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await getAuth().signOut();
      setNotice("");
    } catch (error) {
      setNotice(authMessage(error));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return { status, complete, busy, notice, setNotice, reset, signOut };
}
