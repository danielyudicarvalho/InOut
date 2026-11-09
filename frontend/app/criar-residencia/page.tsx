import { AuthenticatedGate } from "../../components/auth/authenticated-gate";
import { CreateHouseholdScreen } from "../../components/screens/create-household-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <CreateHouseholdScreen />
    </AuthenticatedGate>
  );
}
