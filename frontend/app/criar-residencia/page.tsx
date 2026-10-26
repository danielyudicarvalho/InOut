import { AuthenticatedGate } from "../../components/authenticated-gate";
import { CreateHouseholdScreen } from "../../components/create-household-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <CreateHouseholdScreen />
    </AuthenticatedGate>
  );
}
