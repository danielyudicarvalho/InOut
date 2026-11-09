import { HostedAccountScreen } from "./HostedAccountScreen";

export function EmailConfirmationScreen({
  state = "pending",
}: {
  state?: "pending" | "confirmed" | "invalid";
}) {
  const body =
    state === "confirmed"
      ? "O e-mail foi confirmado. Entre pelo navegador do sistema para abrir o Ninho."
      : state === "invalid"
        ? "O link não pôde ser confirmado. Abra a página hospedada e use o código do e-mail."
        : "Abra a página hospedada e informe o código recebido. A confirmação não acontece com a senha sozinha.";
  return (
    <HostedAccountScreen
      title="Confirmar e-mail"
      body={body}
      path="/account/confirm"
    />
  );
}
