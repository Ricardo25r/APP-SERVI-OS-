import * as React from "react";

import { cn } from "@/lib/utils";
import { Badge, type BadgeProps } from "@/components/ui/badge";

/**
 * `StatusBadge` — pílula por status, reutilizando `Badge` + tokens.
 *
 * Resolve um `status` conhecido (lead/verificação/pagamento) em
 * `{ label, variant }`. Para status fora do mapa padrão, passe `label`
 * (e opcionalmente `variant`/`tone`) manualmente, ou estenda via prop `map`.
 */

/** Tons tonais extras (além das variantes do `Badge`), por token. */
type StatusTone = "info" | "warning";

const TONE_CLASS: Record<StatusTone, string> = {
  // Azul tonal (informativo) — usa o token primário.
  info: "border-transparent bg-primary/10 text-primary hover:bg-primary/10",
  // Laranja tonal (atenção/pendente) — usa o token de marca.
  warning: "border-transparent bg-brand/10 text-brand hover:bg-brand/10",
};

interface StatusConfig {
  label: string;
  variant?: BadgeProps["variant"];
  tone?: StatusTone;
}

/** Mapa padrão de status → rótulo PT-BR + estilo (token-based). */
const DEFAULT_STATUS_MAP: Record<string, StatusConfig> = {
  // Lead status (backend `LeadStatus`).
  open: { label: "Aberta", variant: "success" },
  purchased: { label: "Comprada", tone: "info" },
  closed: { label: "Finalizada", variant: "secondary" },
  cancelled: { label: "Cancelada", variant: "destructive" },
  // Estados de andamento usuais.
  in_progress: { label: "Em andamento", tone: "info" },
  in_review: { label: "Em análise", tone: "warning" },
  pending: { label: "Pendente", tone: "warning" },
  completed: { label: "Concluída", variant: "success" },
  // Verificação / qualidade.
  verified: { label: "Verificado", variant: "success" },
  unverified: { label: "Não verificado", variant: "secondary" },
  premium: { label: "Premium", tone: "warning" },
  // Disponibilidade (`AvailabilityStatus`).
  available: { label: "Disponível", variant: "success" },
  busy: { label: "Ocupado", tone: "warning" },
  unavailable: { label: "Indisponível", variant: "secondary" },
};

export interface StatusBadgeProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** Chave de status conhecida (ex.: "open", "verified"). */
  status?: string;
  /** Rótulo manual — sobrepõe o do mapa. */
  label?: string;
  /** Variante do `Badge` manual — sobrepõe a do mapa. */
  variant?: BadgeProps["variant"];
  /** Tom tonal manual — sobrepõe o do mapa. */
  tone?: StatusTone;
  /** Mapa adicional/override por status. */
  map?: Record<string, StatusConfig>;
}

function StatusBadge({
  status,
  label,
  variant,
  tone,
  map,
  className,
  ...props
}: StatusBadgeProps) {
  const config: Partial<StatusConfig> =
    (status ? { ...DEFAULT_STATUS_MAP, ...map }[status] : undefined) ?? {};

  const resolvedLabel = label ?? config.label ?? status ?? "";
  const resolvedTone = tone ?? config.tone;
  const resolvedVariant = variant ?? config.variant ?? "secondary";

  return (
    <Badge
      variant={resolvedTone ? "secondary" : resolvedVariant}
      className={cn(resolvedTone ? TONE_CLASS[resolvedTone] : undefined, className)}
      {...props}
    >
      {resolvedLabel}
    </Badge>
  );
}

export { StatusBadge, DEFAULT_STATUS_MAP };
