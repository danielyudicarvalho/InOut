import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/authenticated-gate";
import { CorrectionHistoryScreen } from "../../components/correction-history-screen";

export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p>Carregando histórico de correções…</p>}>
        <CorrectionHistoryScreen />
      </Suspense>
    </AuthenticatedGate>
  );
}
