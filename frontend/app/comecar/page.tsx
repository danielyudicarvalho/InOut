import { AuthenticatedGate } from "../../components/auth/authenticated-gate";
import { HouseholdChoiceScreen } from "../../components/screens/household-choice-screen";

export default function Page() {
  return (
    <AuthenticatedGate>
      <HouseholdChoiceScreen />
    </AuthenticatedGate>
  );
}
