"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Root-level error boundary: reports render errors that escape every other
// boundary, then offers a reload. Keeps markup minimal because the root layout
// (and its styles) failed to render.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <main>
          <h1>Algo deu errado</h1>
          <p>Não conseguimos carregar esta página. Tente novamente.</p>
          <button type="button" onClick={() => reset()}>
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
