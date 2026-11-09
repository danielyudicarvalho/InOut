import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { AccessRemoved } from "../screens/HouseholdManagementScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <AccessRemoved />
    </AuthenticatedGate>
  );
}
