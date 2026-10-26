import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { InitialAccountScreen } from "../screens/InitialAccountScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <InitialAccountScreen key="conta-pronta" initialReady />
    </AuthenticatedGate>
  );
}
