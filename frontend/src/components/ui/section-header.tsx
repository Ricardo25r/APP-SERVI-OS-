import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * `SectionHeader` — título de seção + link opcional "Ver todas" à direita.
 *
 * Usado em listas da Home/Dashboard (ver mockup Home contratante).
 */
export interface SectionHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Título da seção. */
  title: React.ReactNode;
  /** Subtítulo/descrição opcional (muted). */
  description?: React.ReactNode;
  /** Texto do link de ação (default: "Ver todas"). */
  actionLabel?: string;
  /** Destino do link de ação. Se ausente, o link não é exibido. */
  actionHref?: string;
  /** Nível do heading semântico. */
  as?: "h2" | "h3";
}

const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  (
    {
      className,
      title,
      description,
      actionLabel = "Ver todas",
      actionHref,
      as = "h2",
      ...props
    },
    ref
  ) => {
    const Heading = as;
    return (
      <div
        ref={ref}
        className={cn("flex items-center justify-between gap-3", className)}
        {...props}
      >
        <div className="min-w-0">
          <Heading className="text-base font-bold tracking-tight">
            {title}
          </Heading>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actionHref ? (
          <Link
            href={actionHref}
            className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primary hover:underline"
          >
            {actionLabel}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
      </div>
    );
  }
);
SectionHeader.displayName = "SectionHeader";

export { SectionHeader };
