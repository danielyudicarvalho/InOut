"use client";

import { Plant } from "@phosphor-icons/react";

export function VerificationBottomNotice() {
  return (
    <aside className="verification-bottom-notice">
      <Plant size={19} weight="fill" />
      <span>
        Você pode sair desta tela e conferir o resultado no histórico.
      </span>
    </aside>
  );
}
