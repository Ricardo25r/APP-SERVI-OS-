import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * `IconChip` — quadrado arredondado com fundo tonal e ícone lucide.
 *
 * Usado em listas, categorias e cards (ver mockups Config/Suporte e Home).
 * A cor é sempre derivada de tokens (nunca hardcoded): a prop `color` mapeia
 * para o par fundo-tonal/ícone correspondente.
 */
const iconChipVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-xl",
  {
    variants: {
      color: {
        default: "bg-secondary text-secondary-foreground",
        blue: "bg-primary/10 text-primary",
        orange: "bg-brand/10 text-brand",
        green: "bg-success/10 text-success",
        muted: "bg-muted text-muted-foreground",
      },
      size: {
        sm: "h-9 w-9",
        md: "h-11 w-11",
      },
    },
    defaultVariants: {
      color: "default",
      size: "md",
    },
  }
);

const ICON_SIZE: Record<"sm" | "md", string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
};

export interface IconChipProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    VariantProps<typeof iconChipVariants> {
  /** Ícone lucide a ser renderizado (ex.: `Wrench`). */
  icon: LucideIcon;
}

const IconChip = React.forwardRef<HTMLSpanElement, IconChipProps>(
  ({ className, color, size, icon: Icon, ...props }, ref) => {
    const resolvedSize: "sm" | "md" = size ?? "md";
    return (
      <span
        ref={ref}
        className={cn(iconChipVariants({ color, size }), className)}
        {...props}
      >
        <Icon className={ICON_SIZE[resolvedSize]} aria-hidden />
      </span>
    );
  }
);
IconChip.displayName = "IconChip";

export { IconChip, iconChipVariants };
