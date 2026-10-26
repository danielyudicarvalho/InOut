import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { BalanceCompositionScreen } from "../screens/BalanceCompositionScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <BalanceCompositionScreen />
    </AuthenticatedGate>
  );
}
