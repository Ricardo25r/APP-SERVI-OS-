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
