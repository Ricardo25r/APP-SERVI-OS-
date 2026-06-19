/**
 * `StarRating` — exibição de estrelas (0–5) a partir de um número.
 * `StarRatingInput` — variante interativa (input) para o formulário.
 *
 * Estrelas preenchidas usam o token de marca (`text-brand`, laranja) com
 * `fill-current`; vazias usam `text-muted-foreground`. Sem cor hardcoded.
 */
"use client";

import { useState } from "react";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

type StarSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<StarSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-7 w-7",
};

interface StarRatingProps {
  /** Nota de 0 a 5 (arredondada para a estrela cheia mais próxima). */
  value: number;
  /** Quantidade total de estrelas. Padrão 5. */
  max?: number;
  size?: StarSize;
  className?: string;
  /** Rótulo acessível. Padrão derivado da nota. */
  label?: string;
}

/** Exibe estrelas estáticas a partir de uma nota (sem meio-passo). */
export function StarRating({
  value,
  max = 5,
  size = "md",
  className,
  label,
}: StarRatingProps) {
  const filled = Math.max(0, Math.min(max, Math.round(value)));
  const aria = label ?? `${filled} de ${max} estrelas`;

  return (
    <div
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={aria}
    >
      {Array.from({ length: max }).map((_, i) => {
        const isFilled = i < filled;
        return (
          <Star
            key={i}
            aria-hidden
            className={cn(
              SIZE_CLASS[size],
              isFilled
                ? "fill-current text-brand"
                : "text-muted-foreground/40"
            )}
          />
        );
      })}
    </div>
  );
}

interface StarRatingInputProps {
  /** Nota selecionada (1–5) ou 0 quando nada selecionado. */
  value: number;
  onChange: (value: number) => void;
  max?: number;
  size?: StarSize;
  disabled?: boolean;
  className?: string;
  /** Rótulo acessível do grupo (radiogroup). */
  label?: string;
}

const SCORE_HINT: Record<number, string> = {
  1: "Péssimo",
  2: "Ruim",
  3: "Regular",
  4: "Bom",
  5: "Excelente",
};

/**
 * Seleção interativa de estrelas. Acessível: cada estrela é um `radio` dentro
 * de um `radiogroup`; navegável por teclado (setas) e clicável pelo mouse.
 */
export function StarRatingInput({
  value,
  onChange,
  max = 5,
  size = "lg",
  disabled,
  className,
  label = "Selecione uma nota de 1 a 5 estrelas",
}: StarRatingInputProps) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? value;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(max, (value || 0) + 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(1, (value || 1) - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(1);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(max);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      onMouseLeave={() => setHover(null)}
      className={cn(
        "inline-flex items-center gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      {Array.from({ length: max }).map((_, i) => {
        const score = i + 1;
        const isActive = score <= active;
        return (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={value === score}
            aria-label={`${score} ${score === 1 ? "estrela" : "estrelas"}${
              SCORE_HINT[score] ? ` — ${SCORE_HINT[score]}` : ""
            }`}
            disabled={disabled}
            tabIndex={-1}
            onClick={() => onChange(score)}
            onMouseEnter={() => setHover(score)}
            className={cn(
              "rounded-sm transition-transform",
              !disabled && "hover:scale-110 cursor-pointer",
              disabled && "cursor-not-allowed"
            )}
          >
            <Star
              aria-hidden
              className={cn(
                SIZE_CLASS[size],
                isActive
                  ? "fill-current text-brand"
                  : "text-muted-foreground/40"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
