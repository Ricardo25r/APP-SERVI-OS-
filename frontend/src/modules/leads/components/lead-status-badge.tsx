import { Badge } from "@/components/ui/badge";
import type { LeadStatus } from "@/types";

import { LEAD_STATUS_BADGE_VARIANT, leadStatusLabel } from "../constants";

/** Badge colorido com o rótulo PT-BR do status do lead. */
export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge variant={LEAD_STATUS_BADGE_VARIANT[status] ?? "secondary"}>
      {leadStatusLabel(status)}
    </Badge>
  );
}
