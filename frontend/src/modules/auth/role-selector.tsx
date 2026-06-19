/**
 * Seletor de tipo de conta (Contratante x Profissional) em 2 cards selecionáveis.
 *
 * Substitui visualmente o `<select>` de papel mantendo o MESMO valor `role`
 * ("customer" | "professional"). É um componente controlado: recebe o valor
 * atual e dispara `onChange` — a página continua dona do estado via RHF
 * (`watch`/`setValue`), preservando validação e submit.
 *
 * Acessível: usa `role="radiogroup"` + botões `role="radio"` com `aria-checked`.
 */
import * as React from "react";
import { Briefcase, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

type AccountRole = "customer" | "professional";

interface RoleOption {
  value: AccountRole;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Classe tonal do IconChip. */
  chipClassName: string;
}

const OPTIONS: RoleOption[] = [
  {
    value: "customer",
    title: "Contratante",
    description: "Quero contratar serviços",
    icon: UserRound,
    chipClassName: "bg-primary/10 text-primary",
  },
  {
    value: "professional",
    title: "Profissional",
    description: "Quero oferecer serviços",
    icon: Briefcase,
    chipClassName: "bg-brand/10 text-brand",
  },
];

export interface RoleSelectorProps {
  value: AccountRole;
  onChange: (value: AccountRole) => void;
  /** `id` do rótulo do grupo, para `aria-labelledby`. */
  labelledById?: string;
  /** Marca os cards como inválidos (estado de erro). */
  invalid?: boolean;
  /** `id` do elemento de erro, para `aria-describedby` do grupo. */
  describedById?: string;
}

export function RoleSelector({
  value,
  onChange,
  labelledById,
  invalid,
  describedById,
}: RoleSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label={labelledById ? undefined : "Tipo de conta"}
      aria-labelledby={labelledById}
      aria-invalid={invalid || undefined}
      aria-describedby={describedById}
      className="grid grid-cols-2 gap-3"
    >
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-xl border-2 bg-card p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-accent/40",
              invalid && !selected && "border-destructive/50"
            )}
          >
            <span
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-lg",
                option.chipClassName
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-sm font-semibold text-foreground">
              {option.title}
            </span>
            <span className="text-xs text-muted-foreground">
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
