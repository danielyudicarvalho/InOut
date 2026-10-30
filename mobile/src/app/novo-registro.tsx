import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { NewRecordScreen } from "../screens/NewRecordScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <NewRecordScreen />
    </AuthenticatedGate>
  );
}
