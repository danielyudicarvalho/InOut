import { AuthenticatedGate } from "../../components/auth/authenticated-gate";
import { InvitationResultScreen } from "../../components/screens/invitation-result-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <InvitationResultScreen key="expired" result="expired" />
    </AuthenticatedGate>
  );
}
