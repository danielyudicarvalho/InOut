import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { PendingVerificationScreen } from "../screens/PendingVerificationScreen";

export default function Page() {
  return (
    <AuthenticatedGate>
      <PendingVerificationScreen />
    </AuthenticatedGate>
  );
}
