import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/authenticated-gate";
import { CreateAccountScreen } from "../../components/create-account-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p role="status">Carregando conta financeira…</p>}>
        <CreateAccountScreen />
      </Suspense>
    </AuthenticatedGate>
  );
}
