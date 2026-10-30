import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { CategoryScreen } from "../screens/CategoryScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <CategoryScreen />
    </AuthenticatedGate>
  );
}
