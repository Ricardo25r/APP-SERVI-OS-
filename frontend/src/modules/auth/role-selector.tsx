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
import Image from "next/image";

import { cn } from "@/lib/utils";

type AccountRole = "customer" | "professional";

interface RoleOption {
  value: AccountRole;
  title: string;
  description: string;
  /** Busto (mascote) exibido no card. */
  image: string;
  /** Classe tonal do fundo do avatar. */
  chipClassName: string;
}

const OPTIONS: RoleOption[] = [
  {
    value: "customer",
    title: "Contratante",
    description: "Quero contratar serviços",
    image: "/brand/duo-contratante.png",
    chipClassName: "bg-primary/10",
  },
  {
    value: "professional",
    title: "Profissional",
    description: "Quero oferecer serviços",
    image: "/brand/duo-profissional.png",
    chipClassName: "bg-brand/10",
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
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border-2 bg-card p-4 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-accent/40",
              invalid && !selected && "border-destructive/50"
            )}
          >
            <span
              className={cn(
                "flex h-20 w-full items-center justify-center overflow-hidden rounded-lg",
                option.chipClassName
              )}
            >
              <Image
                src={option.image}
                width={220}
                height={160}
                alt=""
                aria-hidden
                className="h-full w-auto object-contain"
              />
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
