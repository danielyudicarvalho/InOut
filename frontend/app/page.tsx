import { AuthenticatedGate } from "../components/auth/authenticated-gate";
import { WelcomeScreen } from "../components/screens/welcome-screen";
export default function Home() {
  return (
    <AuthenticatedGate allowAnonymous>
      <WelcomeScreen />
    </AuthenticatedGate>
  );
}
