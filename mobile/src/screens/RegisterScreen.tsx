import { HostedAccountScreen } from "./HostedAccountScreen";

export function RegisterScreen() {
  return (
    <HostedAccountScreen
      title="Criar conta"
      body="O cadastro abre no navegador do sistema. O aplicativo não coleta nem guarda a senha."
      path="/account/register"
    />
  );
}
