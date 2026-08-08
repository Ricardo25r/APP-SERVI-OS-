/**
 * Peças reutilizáveis do site institucional (apresentacionais, sem hooks).
 *
 * Container/Section para ritmo vertical consistente, título de seção, e tiles
 * de categoria, passo numerado e benefício. Cores sempre via token.
 */

import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Largura máxima + respiro lateral padrão do site. */
export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-6xl px-4 sm:px-6", className)}>
      {children}
    </div>
  );
}

/** Bloco de seção com padding vertical. */
export function Section({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={cn("py-12 sm:py-16", className)}>{children}</section>;
}

/** Título de seção centralizado, com subtítulo opcional. */
export function SectionTitle({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-3 text-base text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}

/** Tile de categoria (foto real ou ícone tonal + nome); vira link se `href`. */
export function CategoryTile({
  name,
  icon: Icon,
  href,
  image,
}: {
  name: string;
  icon: LucideIcon;
  href?: string;
  image?: string;
}) {
  const inner = (
    <>
      {image ? (
        <span className="relative h-20 w-20 overflow-hidden rounded-2xl ring-1 ring-border">
          <Image
            src={image}
            alt={name}
            fill
            sizes="80px"
            className="object-cover"
          />
        </span>
      ) : (
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-7 w-7" aria-hidden />
        </span>
      )}
      <span className="text-sm font-bold">{name}</span>
    </>
  );

  const cls =
    "flex flex-col items-center gap-3 rounded-2xl border bg-card p-4 text-center transition-colors hover:border-primary/40 hover:shadow-sm";

  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** Passo numerado (badge com número + título + descrição opcional). */
export function NumberedStep({
  n,
  title,
  description,
  center = false,
}: {
  n: number;
  title: string;
  description?: string;
  center?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-4",
        center && "flex-col items-center text-center"
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-extrabold text-primary">
        {n}
      </span>
      <div>
        <h3 className="text-base font-bold">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Tile de benefício/confiança (ícone + título + descrição opcional). */
export function FeatureTile({
  icon: Icon,
  title,
  description,
  color = "blue",
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  color?: "blue" | "orange" | "green";
}) {
  const tone =
    color === "green"
      ? "bg-success/10 text-success"
      : color === "orange"
        ? "bg-brand/10 text-brand"
        : "bg-primary/10 text-primary";

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-6 text-center">
      <span
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-2xl",
          tone
        )}
      >
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="text-base font-bold">{title}</h3>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
