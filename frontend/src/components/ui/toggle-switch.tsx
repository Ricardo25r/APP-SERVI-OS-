"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * `ToggleSwitch` — interruptor (switch) acessível, no estilo dos mockups
 * (Tela 21 — Notificações). Apenas tokens: ligado em `bg-primary`, desligado
 * em `bg-muted`. Controlado por `checked`/`onCheckedChange`.
 *
 * NOTA: nas telas de Preferências (Configurações) os toggles são **visuais**
 * (sem backend). Mantêm estado local apenas para a interação na UI.
 */
export interface ToggleSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Rótulo acessível (obrigatório p/ a11y quando sem `<label>` visível). */
  label: string;
  disabled?: boolean;
  className?: string;
}

export function ToggleSwitch({
  checked,
  onCheckedChange,
  label,
  disabled,
  className,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-muted",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-background shadow-sm transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
