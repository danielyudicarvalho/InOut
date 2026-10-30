import { AuthenticatedGate } from "../auth/AuthenticatedGate";
import { WelcomeScreen } from "../screens/WelcomeScreen";
export default function Page() {
  return (
    <AuthenticatedGate allowAnonymous>
      <WelcomeScreen fontsReady />
    </AuthenticatedGate>
  );
}
