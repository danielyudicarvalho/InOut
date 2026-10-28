import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { LedgerHistoryScreen } from "../screens/LedgerHistoryScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <LedgerHistoryScreen />
    </AuthenticatedGate>
  );
}
