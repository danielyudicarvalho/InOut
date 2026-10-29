import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { DuplicateResolutionScreen } from "../screens/DuplicateResolutionScreen";

export default function Page() {
  return (
    <AuthenticatedGate>
      <DuplicateResolutionScreen />
    </AuthenticatedGate>
  );
}
