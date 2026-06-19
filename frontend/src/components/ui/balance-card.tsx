import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * `BalanceCard` — card de destaque (gradiente azul → navy) com texto branco.
 *
 * Usado na Carteira/Créditos (telas 05/20): saldo grande + legenda + slot de
 * ações (botões). Fundo deriva de tokens (`from-primary` → `to-blue-800`).
 */
export interface BalanceCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Rótulo acima do saldo (ex.: "Saldo de créditos"). */
  label: string;
  /** Saldo de destaque (número ou texto já formatado). */
  value: React.ReactNode;
  /** Legenda opcional abaixo do saldo (ex.: equivalente em R$). */
  caption?: React.ReactNode;
  /** Slot de ações (botões) exibido no rodapé do card. */
  actions?: React.ReactNode;
}

const BalanceCard = React.forwardRef<HTMLDivElement, BalanceCardProps>(
  ({ className, label, value, caption, actions, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl bg-gradient-to-br from-primary to-blue-800 p-5 text-primary-foreground shadow-sm",
          className
        )}
        {...props}
      >
        <p className="text-sm font-medium text-primary-foreground/80">
          {label}
        </p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
        {caption ? (
          <p className="mt-1 text-sm text-primary-foreground/80">{caption}</p>
        ) : null}
        {children}
        {actions ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    );
  }
);
BalanceCard.displayName = "BalanceCard";

export { BalanceCard };
