import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/authenticated-gate";
import { BalanceCompositionScreen } from "../../components/balance-composition-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p role="status">Carregando composição…</p>}>
        <BalanceCompositionScreen />
      </Suspense>
    </AuthenticatedGate>
  );
}
