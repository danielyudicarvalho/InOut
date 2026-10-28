import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { CreateAccountScreen } from "../screens/CreateAccountScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <CreateAccountScreen />
    </AuthenticatedGate>
  );
}
