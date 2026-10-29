import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/auth/authenticated-gate";
import { TransactionDetailScreen } from "../../components/screens/transaction-detail-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p>Carregando lançamento…</p>}>
        <TransactionDetailScreen />
      </Suspense>
    </AuthenticatedGate>
  );
}
