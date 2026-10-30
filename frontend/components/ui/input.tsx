"use client";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id?: string;
  /** Rótulo visível e obrigatório (associado via `<label for>`). */
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  iconStart?: ReactNode;
  /** Ação à direita, ex.: botão mostrar senha com `aria-label`/`aria-pressed`. */
  trailing?: ReactNode;
  className?: string;
  labelClassName?: string;
  fieldClassName?: string;
};

/**
 * Campo base (spec §4). O foco é sinalizado no container via `:focus-within`
 * com `--color-focus`; o `<input>` não usa `outline: none`.
 */
export function Input({
  id,
  label,
  hint,
  error,
  iconStart,
  trailing,
  className,
  labelClassName,
  fieldClassName,
  disabled,
  ...rest
}: InputProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy =
    [rest["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className={["ui-input", className].filter(Boolean).join(" ")}>
      <label htmlFor={inputId} className={labelClassName}>
        {label}
      </label>
      <div
        className={[
          "ui-input__field",
          error ? "ui-input__field--error" : null,
          disabled ? "ui-input__field--disabled" : null,
          fieldClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {iconStart ? (
          <span className="ui-input__icon" aria-hidden="true">
            {iconStart}
          </span>
        ) : null}
        <input
          {...rest}
          id={inputId}
          disabled={disabled}
          className="ui-input__control"
          aria-invalid={error ? true : rest["aria-invalid"]}
          aria-describedby={describedBy}
        />
        {trailing ? (
          <span className="ui-input__trailing">{trailing}</span>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className="ui-input__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="ui-input__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
