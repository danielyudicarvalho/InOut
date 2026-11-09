import { Suspense } from "react";
import { AuthenticatedGate } from "../../../components/auth/authenticated-gate";
import { AnalysisScreen } from "../../../components/analysis-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p role="status">Carregando análises…</p>}>
        <AnalysisScreen view="overview" />
      </Suspense>
    </AuthenticatedGate>
  );
}
