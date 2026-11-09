import type { Metadata } from "next";
import { AuthCallbackScreen } from "../../../components/screens/auth-callback-screen";
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AuthCallbackScreen recovery />;
}
