import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/authenticated-gate";
import { ExpenseScreen } from "../../components/expense-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p role="status">Carregando despesas…</p>}>
        <ExpenseScreen />
      </Suspense>
    </AuthenticatedGate>
  );
}
