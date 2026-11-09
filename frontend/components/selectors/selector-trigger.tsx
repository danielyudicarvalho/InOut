"use client";

import { type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";

export function SelectorTrigger({
  id,
  label,
  valueText,
  placeholder,
  icon,
  onClick,
  disabled = false,
}: {
  id?: string;
  label?: string;
  valueText?: string | null;
  placeholder: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  const isFilled = Boolean(valueText && valueText.trim().length > 0);

  return (
    <div className="ninho-field-group">
      {label ? <span className="ninho-field-label">{label}</span> : null}
      <button
        type="button"
        id={id}
        className={`ninho-selector-trigger ${isFilled ? "has-value" : "is-placeholder"}`}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={onClick}
      >
        <span className="ninho-trigger-icon-wrap" aria-hidden="true">
          {icon}
        </span>
        <span className="ninho-trigger-text">
          {isFilled ? valueText : placeholder}
        </span>
        <span className="ninho-trigger-caret" aria-hidden="true">
          <CaretDown size={14} weight="bold" />
        </span>
      </button>
    </div>
  );
}
