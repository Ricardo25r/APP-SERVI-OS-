import * as React from "react";
import Image from "next/image";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * `Avatar` — foto (next/image) ou iniciais em círculo.
 *
 * Sem `src`, exibe as iniciais derivadas de `name` sobre fundo tonal azul
 * (`bg-primary/10 text-primary`). Tamanhos sm/md/lg.
 */
const avatarVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary",
  {
    variants: {
      size: {
        sm: "h-8 w-8 text-xs",
        md: "h-10 w-10 text-sm",
        lg: "h-14 w-14 text-base",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

const PIXELS: Record<NonNullable<AvatarProps["size"]>, number> = {
  sm: 32,
  md: 40,
  lg: 56,
};

/** Deriva até 2 iniciais de um nome (ex.: "Maria Oliveira" → "MO"). */
function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]![0] ?? "" : "";
  return (first + last).toUpperCase();
}

export interface AvatarProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof avatarVariants> {
  /** URL da foto. Se ausente, exibe iniciais. */
  src?: string | null;
  /** Nome usado p/ `alt` e iniciais. */
  name?: string;
}

const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, size, src, name, ...props }, ref) => {
    const resolvedSize = size ?? "md";
    const px = PIXELS[resolvedSize];
    return (
      <span
        ref={ref}
        className={cn(avatarVariants({ size }), className)}
        {...props}
      >
        {src ? (
          <Image
            src={src}
            alt={name ?? "Avatar"}
            width={px}
            height={px}
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-hidden>{getInitials(name)}</span>
        )}
      </span>
    );
  }
);
Avatar.displayName = "Avatar";

export { Avatar, getInitials };
