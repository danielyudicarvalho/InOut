import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { InvitationResultScreen } from "../screens/InvitationResultScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <InvitationResultScreen key="expired" result="expired" />
    </AuthenticatedGate>
  );
}
