import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/auth/authenticated-gate";
import { BalanceCompositionScreen } from "../../components/screens/balance-composition-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p role="status">Carregando composição…</p>}>
        <BalanceCompositionScreen />
      </Suspense>
    </AuthenticatedGate>
  );
}
