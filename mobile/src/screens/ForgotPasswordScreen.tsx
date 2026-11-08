import { HostedAccountScreen } from "./HostedAccountScreen";

export function ForgotPasswordScreen() {
  return (
    <HostedAccountScreen
      title="Esqueci a senha"
      body="A recuperação abre no navegador do sistema. O código e a nova senha não passam pelo aplicativo."
      path="/account/forgot"
    />
  );
}
