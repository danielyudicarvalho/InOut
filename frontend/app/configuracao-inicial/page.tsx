import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/auth/authenticated-gate";
import { CreateAccountScreen } from "../../components/screens/create-account-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p role="status">Carregando conta financeira…</p>}>
        <CreateAccountScreen />
      </Suspense>
    </AuthenticatedGate>
  );
}
