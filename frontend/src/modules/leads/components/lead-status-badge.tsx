import { StatusBadge } from "@/components/ui/status-badge";
import type { LeadStatus } from "@/types";

import { leadStatusLabel } from "../constants";

/**
 * Badge de status do lead reutilizando o primitivo `StatusBadge` do design
 * system (cores tonais por token). O rotulo PT-BR continua vindo de
 * `constants.ts` (Aberta/Adquirida/Encerrada/Cancelada) para preservar os
 * termos ja usados no projeto, enquanto a cor/tom segue o `DEFAULT_STATUS_MAP`.
 */
export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <StatusBadge status={status} label={leadStatusLabel(status)} />;
}
