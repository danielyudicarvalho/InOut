import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/auth/authenticated-gate";
import { IncomeScreen } from "../../components/screens/income-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p role="status">Carregando receitas…</p>}>
        <IncomeScreen />
      </Suspense>
    </AuthenticatedGate>
  );
}
