import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { IconChip, type IconChipProps } from "@/components/ui/icon-chip";

/**
 * `SettingsRow` — linha de lista no estilo dos mockups de Configurações/Suporte
 * (Telas 21/22): `IconChip` à esquerda + título/subtítulo + ação à direita
 * (chevron por padrão, ou um slot livre p/ toggle/badge).
 *
 * Renderiza como `Link` (quando `href`), `button` (quando `onClick`) ou `div`
 * (estático). Apenas tokens do design system — sem cor hardcoded.
 */
type RowColor = NonNullable<IconChipProps["color"]>;

export interface SettingsRowProps {
  /** Ícone lucide exibido no `IconChip`. */
  icon: LucideIcon;
  /** Cor tonal do `IconChip` (token). */
  iconColor?: RowColor;
  /** Título da linha. */
  title: React.ReactNode;
  /** Subtítulo/descrição opcional (muted). */
  description?: React.ReactNode;
  /** Destino — renderiza como `next/link`. */
  href?: string;
  /** Handler — renderiza como `button`. */
  onClick?: () => void;
  /**
   * Conteúdo à direita (ex.: toggle, `StatusBadge`, valor). Quando ausente e a
   * linha é navegável (`href`/`onClick`), exibe um chevron.
   */
  trailing?: React.ReactNode;
  /** Esconde o chevron padrão das linhas navegáveis. */
  hideChevron?: boolean;
  /** Estiliza a linha como destrutiva (ex.: "Sair"). */
  destructive?: boolean;
  className?: string;
}

function RowInner({
  icon,
  iconColor = "blue",
  title,
  description,
  trailing,
  hideChevron,
  destructive,
  navigable,
}: SettingsRowProps & { navigable: boolean }) {
  return (
    <>
      <IconChip
        icon={icon}
        color={destructive ? "muted" : iconColor}
        size="md"
        className={cn(destructive && "bg-destructive/10 text-destructive")}
      />
      <span className="min-w-0 flex-1 text-left">
        <span
          className={cn(
            "block truncate text-sm font-semibold",
            destructive ? "text-destructive" : "text-foreground"
          )}
        >
          {title}
        </span>
        {description ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
      {trailing ? (
        <span className="ml-auto flex shrink-0 items-center">{trailing}</span>
      ) : navigable && !hideChevron ? (
        <ChevronRight
          className="ml-auto h-5 w-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      ) : null}
    </>
  );
}

const ROW_BASE =
  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors";

export function SettingsRow({
  href,
  onClick,
  className,
  ...rest
}: SettingsRowProps) {
  const interactive =
    "rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-accent/60";

  if (href) {
    return (
      <Link
        href={href}
        className={cn(ROW_BASE, interactive, className)}
      >
        <RowInner {...rest} navigable />
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(ROW_BASE, interactive, className)}
      >
        <RowInner {...rest} navigable />
      </button>
    );
  }

  return (
    <div className={cn(ROW_BASE, className)}>
      <RowInner {...rest} navigable={false} />
    </div>
  );
}

/**
 * `SettingsRowList` — agrupa `SettingsRow`s num card com divisórias entre linhas
 * (estilo lista dos mockups). Use dentro de um `<Card>` ou solto.
 */
export function SettingsRowList({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("divide-y divide-border", className)}>{children}</div>
  );
}
