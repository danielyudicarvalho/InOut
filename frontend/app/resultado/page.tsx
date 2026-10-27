import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/authenticated-gate";
import { ResultScreen } from "../../components/result-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p role="status">Carregando resultado…</p>}>
        <ResultScreen />
      </Suspense>
    </AuthenticatedGate>
  );
}
