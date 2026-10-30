"use client";

import { WarningCircle } from "@phosphor-icons/react";

export function VerificationWarning() {
  return (
    <div className="verification-card-warning" role="alert">
      <WarningCircle size={20} weight="fill" />
      <span>
        Para evitar duplicidade, não crie outro lançamento igual enquanto
        verificamos.
      </span>
    </div>
  );
}
