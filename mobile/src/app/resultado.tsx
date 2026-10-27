import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { ResultScreen } from "../screens/ResultScreen";
export default function Page() {
  return (
    <AuthenticatedGate>
      <ResultScreen />
    </AuthenticatedGate>
  );
}
