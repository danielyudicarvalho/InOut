import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/authenticated-gate";
import { AccountsScreen } from "../../components/accounts-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p>Carregando contas…</p>}>
        <AccountsScreen />
      </Suspense>
    </AuthenticatedGate>
  );
}
