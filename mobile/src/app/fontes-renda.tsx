import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { IncomeSourcesScreen } from "../screens/IncomeSourcesScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <IncomeSourcesScreen />
    </AuthenticatedGate>
  );
}
