import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { DashboardScreen } from "../screens/DashboardScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <DashboardScreen />
    </AuthenticatedGate>
  );
}
