import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/auth/authenticated-gate";
import { DuplicateResolutionScreen } from "../../components/screens/duplicate-resolution-screen";

export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p>Carregando registros duplicados…</p>}>
        <DuplicateResolutionScreen />
      </Suspense>
    </AuthenticatedGate>
  );
}
