import { AuthenticatedGate } from "../../auth/AuthenticatedGate";
import { PlanningScreen } from "../../screens/PlanningScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <PlanningScreen view="hub" />
    </AuthenticatedGate>
  );
}
