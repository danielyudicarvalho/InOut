import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { ExpenseScreen } from "../screens/ExpenseScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <ExpenseScreen />
    </AuthenticatedGate>
  );
}
