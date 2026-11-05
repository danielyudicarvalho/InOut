import { AuthenticatedGate } from "../../auth/AuthenticatedGate";
import { AnalysisScreen } from "../../screens/AnalysisScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <AnalysisScreen view="accounts" />
    </AuthenticatedGate>
  );
}
