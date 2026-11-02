import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/authenticated-gate";
import { TransactionDetailScreen } from "../../components/transaction-detail-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p>Carregando lançamento…</p>}>
        <TransactionDetailScreen />
      </Suspense>
    </AuthenticatedGate>
  );
}
