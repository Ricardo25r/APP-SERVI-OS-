/**
 * Rótulos PT-BR e mapeamentos de variante visual para os enums de Lead.
 *
 * Centraliza a tradução de `lead_type`, `urgency` e `status` para o
 * português usado nas telas do contratante, além de helpers para as
 * opções dos selects do formulário de criação/edição.
 */

import type { LeadStatus, LeadType, LeadUrgency } from "@/types";
import type { BadgeProps } from "@/components/ui/badge";

/* ------------------------------------------------------------------ */
/* Tipo de solicitação                                                */
/* ------------------------------------------------------------------ */

export const LEAD_TYPE_LABELS: Record<LeadType, string> = {
  one_time: "Pontual",
  temporary: "Temporário",
  permanent: "Permanente",
};

export const LEAD_TYPE_OPTIONS: { value: LeadType; label: string }[] = [
  { value: "one_time", label: LEAD_TYPE_LABELS.one_time },
  { value: "temporary", label: LEAD_TYPE_LABELS.temporary },
  { value: "permanent", label: LEAD_TYPE_LABELS.permanent },
];

/* ------------------------------------------------------------------ */
/* Urgência                                                           */
/* ------------------------------------------------------------------ */

export const LEAD_URGENCY_LABELS: Record<LeadUrgency, string> = {
  immediate: "Imediata",
  today: "Hoje",
  this_week: "Esta semana",
  flexible: "Flexível",
};

export const LEAD_URGENCY_OPTIONS: { value: LeadUrgency; label: string }[] = [
  { value: "immediate", label: LEAD_URGENCY_LABELS.immediate },
  { value: "today", label: LEAD_URGENCY_LABELS.today },
  { value: "this_week", label: LEAD_URGENCY_LABELS.this_week },
  { value: "flexible", label: LEAD_URGENCY_LABELS.flexible },
];

/* ------------------------------------------------------------------ */
/* Orçamento (faixas predefinidas)                                    */
/* ------------------------------------------------------------------ */

export const BUDGET_RANGE_LABELS: Record<string, string> = {
  ate_100: "Até R$ 100",
  "100_300": "R$ 100–300",
  "300_500": "R$ 300–500",
  "500_1000": "R$ 500–1.000",
  acima_1000: "Acima de R$ 1.000",
};

export const BUDGET_RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: "ate_100", label: BUDGET_RANGE_LABELS.ate_100 },
  { value: "100_300", label: BUDGET_RANGE_LABELS["100_300"] },
  { value: "300_500", label: BUDGET_RANGE_LABELS["300_500"] },
  { value: "500_1000", label: BUDGET_RANGE_LABELS["500_1000"] },
  { value: "acima_1000", label: BUDGET_RANGE_LABELS.acima_1000 },
];

export function budgetRangeLabel(value?: string | null): string | null {
  if (!value) return null;
  return BUDGET_RANGE_LABELS[value] ?? value;
}

/* ------------------------------------------------------------------ */
/* Status                                                             */
/* ------------------------------------------------------------------ */

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  open: "Aberta",
  purchased: "Adquirida",
  closed: "Encerrada",
  cancelled: "Cancelada",
};

/** Variante de `Badge` por status (cores semânticas). */
export const LEAD_STATUS_BADGE_VARIANT: Record<
  LeadStatus,
  NonNullable<BadgeProps["variant"]>
> = {
  open: "success",
  purchased: "default",
  closed: "secondary",
  cancelled: "destructive",
};

/* ------------------------------------------------------------------ */
/* Helpers de label seguros (fallback p/ valores desconhecidos)       */
/* ------------------------------------------------------------------ */

export function leadTypeLabel(value: LeadType): string {
  return LEAD_TYPE_LABELS[value] ?? value;
}

export function leadUrgencyLabel(value: LeadUrgency): string {
  return LEAD_URGENCY_LABELS[value] ?? value;
}

export function leadStatusLabel(value: LeadStatus): string {
  return LEAD_STATUS_LABELS[value] ?? value;
}
