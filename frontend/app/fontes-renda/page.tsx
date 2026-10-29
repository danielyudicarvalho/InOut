import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/auth/authenticated-gate";
import { IncomeSourcesScreen } from "../../components/screens/income-sources-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p role="status">Carregando fontes de renda…</p>}>
        <IncomeSourcesScreen />
      </Suspense>
    </AuthenticatedGate>
  );
}
