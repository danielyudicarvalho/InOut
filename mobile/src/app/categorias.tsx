import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { CatalogScreen } from "../screens/CatalogScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <CatalogScreen type="categories" />
    </AuthenticatedGate>
  );
}
