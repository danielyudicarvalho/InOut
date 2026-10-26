import { AuthenticatedGate } from "../../components/authenticated-gate";
import { InvitationResultScreen } from "../../components/invitation-result-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <InvitationResultScreen key="expired" result="expired" />
    </AuthenticatedGate>
  );
}
