import type { ReactNode } from "react";

export type ChipTone = "green" | "peach" | "yellow" | "sage" | "danger";

type Base = {
  tone?: ChipTone;
  /** `pill` (texto) ou `icon` (quadrado 48px com ícone). */
  shape?: "pill" | "icon";
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
};

function cls(
  { tone = "green", shape = "pill", className }: Base,
  extra?: string,
) {
  return ["ui-chip", `ui-chip--${tone}`, `ui-chip--${shape}`, extra, className]
    .filter(Boolean)
    .join(" ");
}

function Icon({ icon }: { icon?: ReactNode }) {
  return icon ? (
    <span className="ui-chip__icon" aria-hidden="true">
      {icon}
    </span>
  ) : null;
}

/** Chip estático (spec §4). Ícones Phosphor internos ficam `aria-hidden`. */
export function Chip(props: Base) {
  return (
    <span className={cls(props)}>
      <Icon icon={props.icon} />
      {props.children}
    </span>
  );
}

/** Chip de filtro: sempre `<button aria-pressed>`. */
export function FilterChip({
  selected,
  onToggle,
  ...props
}: Base & { selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cls(props, "ui-chip--interactive")}
    >
      <Icon icon={props.icon} />
      {props.children}
    </button>
  );
}
