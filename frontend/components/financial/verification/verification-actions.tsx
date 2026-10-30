"use client";

import Link from "next/link";
import { ArrowsClockwise, FileText } from "@phosphor-icons/react";

export interface VerificationActionsProps {
  onVerify: () => void;
  historyHref: string;
  submitting?: boolean;
}

export function VerificationActions({
  onVerify,
  historyHref,
  submitting = false,
}: VerificationActionsProps) {
  return (
    <div className="verification-actions">
      <button
        type="button"
        className="verification-primary-btn"
        onClick={onVerify}
        disabled={submitting}
      >
        <ArrowsClockwise
          size={18}
          weight="bold"
          className={submitting ? "spin" : ""}
        />
        <span>{submitting ? "Verificando…" : "Verificar novamente"}</span>
      </button>

      <Link className="verification-secondary-btn" href={historyHref}>
        <FileText size={18} />
        <span>Ir ao histórico</span>
      </Link>

      <small className="verification-actions-help">
        Ao verificar novamente, consultamos esta mesma operação.
      </small>
    </div>
  );
}
