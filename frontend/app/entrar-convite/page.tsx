import { AuthenticatedGate } from "../../components/authenticated-gate";
import { InvitationScreen } from "../../components/invitation-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <InvitationScreen />
    </AuthenticatedGate>
  );
}
