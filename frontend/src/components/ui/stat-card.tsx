import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { IconChip, type IconChipProps } from "@/components/ui/icon-chip";

/**
 * `StatCard` — rótulo pequeno (muted) + número grande.
 *
 * Usado para métricas (ex.: créditos comprados/usados, total de leads).
 * Aceita ícone opcional (renderizado como `IconChip`) e uma variação textual
 * (ex.: "+12%") com tom positivo/negativo/neutro.
 */
export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Rótulo curto exibido acima do valor. */
  label: string;
  /** Valor de destaque (número ou texto já formatado). */
  value: React.ReactNode;
  /** Ícone opcional exibido como `IconChip`. */
  icon?: LucideIcon;
  /** Cor do `IconChip` (default/blue/orange/green/muted). */
  iconColor?: IconChipProps["color"];
  /** Texto de variação opcional (ex.: "+12% no mês"). */
  trend?: string;
  /** Tom da variação. */
  trendTone?: "positive" | "negative" | "neutral";
  /** Fundo do card. */
  variant?: "card" | "muted";
}

const TREND_TONE: Record<NonNullable<StatCardProps["trendTone"]>, string> = {
  positive: "text-success",
  negative: "text-destructive",
  neutral: "text-muted-foreground",
};

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    {
      className,
      label,
      value,
      icon,
      iconColor = "blue",
      trend,
      trendTone = "neutral",
      variant = "card",
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl border p-4",
          variant === "muted" ? "bg-muted" : "bg-card",
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
          </div>
          {icon ? <IconChip icon={icon} color={iconColor} size="sm" /> : null}
        </div>
        {trend ? (
          <p className={cn("mt-2 text-xs font-medium", TREND_TONE[trendTone])}>
            {trend}
          </p>
        ) : null}
      </div>
    );
  }
);
StatCard.displayName = "StatCard";

export { StatCard };
