import { HostedAccountScreen } from "./HostedAccountScreen";

export function ResetPasswordScreen() {
  return (
    <HostedAccountScreen
      title="Nova senha"
      body="Defina a nova senha na página hospedada. A senha anterior não é enfraquecida nem descartada em silêncio."
      path="/account/reset"
    />
  );
}
