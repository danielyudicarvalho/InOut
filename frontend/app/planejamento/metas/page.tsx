import { Suspense } from "react";
import { AuthenticatedGate } from "../../../components/auth/authenticated-gate";
import { PlanningScreen } from "../../../components/planning-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p role="status">Carregando metas…</p>}>
        <PlanningScreen view="goals" />
      </Suspense>
    </AuthenticatedGate>
  );
}
