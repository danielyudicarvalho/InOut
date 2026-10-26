import { AuthenticatedGate } from "../components/authenticated-gate";
import { WelcomeScreen } from "../components/welcome-screen";
export default function Home() {
  return (
    <AuthenticatedGate allowAnonymous>
      <WelcomeScreen />
    </AuthenticatedGate>
  );
}
