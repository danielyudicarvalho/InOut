import { Suspense } from "react";
import { AuthenticatedGate } from "../../components/auth/authenticated-gate";
import { CatalogScreen } from "../../components/catalog-screen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <Suspense fallback={<p>Carregando…</p>}>
        <CatalogScreen type="categories" />
      </Suspense>
    </AuthenticatedGate>
  );
}
