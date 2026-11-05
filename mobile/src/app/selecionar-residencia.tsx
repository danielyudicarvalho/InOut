import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { HouseholdManagementScreen } from "../screens/HouseholdManagementScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <HouseholdManagementScreen choose />
    </AuthenticatedGate>
  );
}
