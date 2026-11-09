import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { AccountsScreen } from "../screens/AccountsScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <AccountsScreen />
    </AuthenticatedGate>
  );
}
