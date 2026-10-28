import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Ninho • InOut",
  description:
    "Seu dinheiro encontra um lar. Organize suas finanças com calma, do seu jeito.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
