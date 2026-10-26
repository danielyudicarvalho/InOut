import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { CreateHouseholdScreen } from "../screens/CreateHouseholdScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <CreateHouseholdScreen />
    </AuthenticatedGate>
  );
}
