import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/auth/authenticated-gate";
import { DashboardScreen } from "../../components/screens/dashboard-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p role="status">Carregando finanças…</p>}>
        <DashboardScreen />
      </Suspense>
    </AuthenticatedGate>
  );
}
