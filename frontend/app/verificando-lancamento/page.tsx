import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/auth/authenticated-gate";
import { PendingVerificationScreen } from "../../components/screens/pending-verification-screen";

export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p>Carregando verificação de lançamento…</p>}>
        <PendingVerificationScreen />
      </Suspense>
    </AuthenticatedGate>
  );
}
