import { Suspense } from "react";
import { SessionScreen } from "../../components/screens/session-screen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SessionScreen key="loading" initialState="loading" />
    </Suspense>
  );
}
