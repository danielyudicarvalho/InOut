import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/auth/authenticated-gate";
import { ResultScreen } from "../../components/screens/result-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p role="status">Carregando resultado…</p>}>
        <ResultScreen />
      </Suspense>
    </AuthenticatedGate>
  );
}
