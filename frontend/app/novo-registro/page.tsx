import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/auth/authenticated-gate";
import { NewRecordScreen } from "../../components/screens/new-record-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p role="status">Carregando novo registro…</p>}>
        <NewRecordScreen />
      </Suspense>
    </AuthenticatedGate>
  );
}
