import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { InvitationScreen } from "../screens/InvitationScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <InvitationScreen />
    </AuthenticatedGate>
  );
}
