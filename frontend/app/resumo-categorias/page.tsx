import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/authenticated-gate";
import { CategoryScreen } from "../../components/category-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p role="status">Carregando categorias…</p>}>
        <CategoryScreen />
      </Suspense>
    </AuthenticatedGate>
  );
}
