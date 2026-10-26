import { AuthenticatedGate } from "../../components/authenticated-gate";
import { DashboardScreen } from "../../components/dashboard-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <DashboardScreen />
    </AuthenticatedGate>
  );
}
