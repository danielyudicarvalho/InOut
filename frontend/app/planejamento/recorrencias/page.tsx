import { Suspense } from "react";
import { AuthenticatedGate } from "../../../components/authenticated-gate";
import { PlanningScreen } from "../../../components/planning-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p role="status">Carregando recorrências…</p>}>
        <PlanningScreen view="recurring" />
      </Suspense>
    </AuthenticatedGate>
  );
}
