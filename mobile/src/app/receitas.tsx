import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { IncomeScreen } from "../screens/IncomeScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <IncomeScreen />
    </AuthenticatedGate>
  );
}
