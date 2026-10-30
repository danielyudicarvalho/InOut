import { AuthenticatedGate } from "../../components/auth/authenticated-gate";
import { InvitationScreen } from "../../components/screens/invitation-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <InvitationScreen />
    </AuthenticatedGate>
  );
}
