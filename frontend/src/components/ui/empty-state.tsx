import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { IconChip } from "@/components/ui/icon-chip";

/**
 * `EmptyState` — ícone + título + descrição + ação opcional.
 *
 * Estado vazio padrão de listas (leads, conversas, notificações, etc.).
 */
export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Ícone lucide ilustrativo. */
  icon?: LucideIcon;
  /** Título curto. */
  title: React.ReactNode;
  /** Descrição opcional (muted). */
  description?: React.ReactNode;
  /** Slot de ação (ex.: `<Button>`). */
  action?: React.ReactNode;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon: Icon, title, description, action, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-10 text-center",
          className
        )}
        {...props}
      >
        {Icon ? <IconChip icon={Icon} color="muted" size="md" /> : null}
        <h3 className="mt-3 text-base font-bold tracking-tight">{title}</h3>
        {description ? (
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    );
  }
);
EmptyState.displayName = "EmptyState";

export { EmptyState };
