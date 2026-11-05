import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/authenticated-gate";
import { HouseholdManagementScreen } from "../../components/household-management-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p>Carregando…</p>}>
        <HouseholdManagementScreen />
      </Suspense>
    </AuthenticatedGate>
  );
}
