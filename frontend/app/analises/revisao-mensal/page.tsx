import { Suspense } from "react";
import { AuthenticatedGate } from "../../../components/authenticated-gate";
import { AnalysisScreen } from "../../../components/analysis-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p role="status">Carregando análises…</p>}>
        <AnalysisScreen view="review" />
      </Suspense>
    </AuthenticatedGate>
  );
}
