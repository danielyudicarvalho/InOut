import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";

export type CardVariant = "default" | "interactive" | "muted";

type Base = { className?: string; children: ReactNode };

function cls(variant: CardVariant, className?: string) {
  return ["ui-card", `ui-card--${variant}`, className]
    .filter(Boolean)
    .join(" ");
}

/** Card base (spec §4). `interactive` exige `href` (link) ou `onClick` (botão). */
export function Card(
  props:
    | (Base & {
        variant?: "default" | "muted";
      } & HTMLAttributes<HTMLDivElement>)
    | (Base & { variant: "interactive"; href: string })
    | (Base & {
        variant: "interactive";
        onClick: () => void;
        href?: undefined;
      }),
) {
  if (props.variant === "interactive") {
    if ("href" in props && props.href !== undefined) {
      return (
        <Link href={props.href} className={cls("interactive", props.className)}>
          {props.children}
        </Link>
      );
    }
    const { onClick } = props as { onClick: () => void };
    return (
      <button
        type="button"
        onClick={onClick}
        className={cls("interactive", props.className)}
      >
        {props.children}
      </button>
    );
  }
  const { variant = "default", className, children, ...rest } = props;
  return (
    <div {...rest} className={cls(variant, className)}>
      {children}
    </div>
  );
}
