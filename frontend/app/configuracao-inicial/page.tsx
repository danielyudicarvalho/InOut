import { AuthenticatedGate } from "../../components/authenticated-gate";
import { InitialAccountScreen } from "../../components/initial-account-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <InitialAccountScreen key="configuracao-inicial" />
    </AuthenticatedGate>
  );
}
