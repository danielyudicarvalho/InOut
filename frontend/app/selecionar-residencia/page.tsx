import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/auth/authenticated-gate";
import { HouseholdManagementScreen } from "../../components/household-management-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p>Carregando…</p>}>
        <HouseholdManagementScreen choose />
      </Suspense>
    </AuthenticatedGate>
  );
}
