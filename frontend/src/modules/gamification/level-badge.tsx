/**
 * `LevelBadge` — badge do nível do profissional (número + nome).
 *
 * Estilo da marca: medalha em `bg-primary`/`text-primary-foreground` com o
 * número do nível e, ao lado, o nome do nível. Apenas tokens do design system.
 */
"use client";

import { Medal } from "lucide-react";

import { cn } from "@/lib/utils";

type LevelBadgeSize = "sm" | "md" | "lg";

const SIZE: Record<
  LevelBadgeSize,
  { medal: string; icon: string; name: string; gap: string }
> = {
  sm: { medal: "h-7 w-7 text-xs", icon: "h-3.5 w-3.5", name: "text-xs", gap: "gap-1.5" },
  md: { medal: "h-9 w-9 text-sm", icon: "h-4 w-4", name: "text-sm", gap: "gap-2" },
  lg: { medal: "h-12 w-12 text-base", icon: "h-5 w-5", name: "text-base", gap: "gap-2.5" },
};

interface LevelBadgeProps {
  level: number;
  /** Nome do nível (ex.: "Ouro"). Opcional — quando ausente, mostra só o número. */
  name?: string | null;
  size?: LevelBadgeSize;
  /** Quando true, esconde o nome e mostra apenas a medalha com o número. */
  iconOnly?: boolean;
  className?: string;
}

export function LevelBadge({
  level,
  name,
  size = "md",
  iconOnly = false,
  className,
}: LevelBadgeProps) {
  const s = SIZE[size];
  const label = name ? `Nível ${level} — ${name}` : `Nível ${level}`;

  return (
    <span
      className={cn("inline-flex items-center", s.gap, className)}
      title={label}
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-bold leading-none text-primary-foreground shadow-sm ring-2 ring-primary/20",
          s.medal
        )}
      >
        {level}
      </span>
      {!iconOnly && (
        <span className={cn("inline-flex items-center gap-1 font-semibold text-foreground", s.name)}>
          <Medal aria-hidden className={cn("text-brand", s.icon)} />
          {name ? name : `Nível ${level}`}
        </span>
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}
