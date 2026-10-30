import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "md" | "sm";

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  className?: string;
  children: ReactNode;
};

export type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    href?: undefined;
  };

export type ButtonLinkProps = CommonProps & {
  href: string;
  disabled?: boolean;
  onClick?: () => void;
};

function classes({ variant = "primary", size = "md", className }: CommonProps) {
  return ["ui-button", `ui-button--${variant}`, `ui-button--${size}`, className]
    .filter(Boolean)
    .join(" ");
}

function Content({ loading, iconStart, iconEnd, children }: CommonProps) {
  return (
    <>
      {loading ? (
        <span className="ui-button__spinner" aria-hidden="true" />
      ) : iconStart ? (
        <span className="ui-button__icon" aria-hidden="true">
          {iconStart}
        </span>
      ) : null}
      <span className="ui-button__label">{children}</span>
      {iconEnd ? (
        <span className="ui-button__icon" aria-hidden="true">
          {iconEnd}
        </span>
      ) : null}
    </>
  );
}

/** Botão base (spec §4). Use `href` para renderizar um link com aparência de botão. */
export function Button(props: ButtonProps | ButtonLinkProps) {
  if (props.href !== undefined) {
    const { href, disabled, onClick, ...rest } = props;
    return (
      <Link
        href={disabled ? "#" : href}
        className={classes(rest)}
        aria-disabled={disabled || undefined}
        aria-busy={rest.loading || undefined}
        tabIndex={disabled ? -1 : undefined}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
            return;
          }
          onClick?.();
        }}
      >
        <Content {...rest} />
      </Link>
    );
  }
  const {
    variant,
    size,
    loading,
    iconStart,
    iconEnd,
    className,
    children,
    disabled,
    type = "button",
    ...rest
  } = props;
  const inert = disabled || loading;
  return (
    <button
      {...rest}
      type={type}
      className={classes({ variant, size, className, children })}
      disabled={disabled}
      aria-disabled={inert || undefined}
      aria-busy={loading || undefined}
    >
      <Content loading={loading} iconStart={iconStart} iconEnd={iconEnd}>
        {children}
      </Content>
    </button>
  );
}
