import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { TransactionDetailScreen } from "../screens/TransactionDetailScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <TransactionDetailScreen />
    </AuthenticatedGate>
  );
}
