import { AuthenticatedGate } from "../../components/authenticated-gate";
import { HouseholdChoiceScreen } from "../../components/household-choice-screen";

export default function Page() {
  return (
    <AuthenticatedGate>
      <HouseholdChoiceScreen />
    </AuthenticatedGate>
  );
}
