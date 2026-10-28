import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { HouseholdChoiceScreen } from "../screens/HouseholdChoiceScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <HouseholdChoiceScreen />
    </AuthenticatedGate>
  );
}
