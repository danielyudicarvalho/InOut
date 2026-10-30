import type { Metadata } from "next";
import { DM_Sans, Lora } from "next/font/google";
import "./tokens.css";
import "./globals.css";
import "./styles/welcome-auth.css";
import "./styles/household.css";
import "./styles/dashboard.css";
import "./styles/ledger-details.css";
import "./styles/correction-history.css";
import "./styles/duplicate-resolution.css";
import "./styles/verification.css";
import "../components/ui/ui.css";
const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});
const lora = Lora({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
  variable: "--font-lora",
  display: "swap",
});
export const metadata: Metadata = {
  title: "Ninho • InOut",
  description:
    "Seu dinheiro encontra um lar. Organize suas finanças com calma, do seu jeito.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${dmSans.variable} ${lora.variable}`}>
      <body>{children}</body>
    </html>
  );
}
