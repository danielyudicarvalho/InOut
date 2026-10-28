import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/authenticated-gate";
import { DashboardScreen } from "../../components/dashboard-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p role="status">Carregando finanças…</p>}>
        <DashboardScreen />
      </Suspense>
    </AuthenticatedGate>
  );
}
