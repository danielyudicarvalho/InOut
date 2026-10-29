import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { CorrectionHistoryScreen } from "../screens/CorrectionHistoryScreen";

export default function Page() {
  return (
    <AuthenticatedGate>
      <CorrectionHistoryScreen />
    </AuthenticatedGate>
  );
}
