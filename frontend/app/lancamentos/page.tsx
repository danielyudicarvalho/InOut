import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/authenticated-gate";
import { LedgerHistoryScreen } from "../../components/ledger-history-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p>Carregando histórico…</p>}>
        <LedgerHistoryScreen />
      </Suspense>
    </AuthenticatedGate>
  );
}
