"use client";

import Link from "next/link";
import { Coins, Eye, MapPin, Pencil, Trash2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import { cn } from "@/lib/utils";
import type { Lead } from "@/types";

import { categoryVisual } from "../category-icon";
import { leadTypeLabel, leadUrgencyLabel } from "../constants";
import { LeadStatusBadge } from "./lead-status-badge";

export interface LeadCardProps {
  lead: Lead;
  /** Dispara o fluxo de cancelamento (confirmação) para este lead. */
  onCancel: (lead: Lead) => void;
}

/** Cartão de uma solicitação na listagem do contratante. */
export function LeadCard({ lead, onCancel }: LeadCardProps) {
  const isOpen = lead.status === "open";
  const categoryName = lead.category?.name ?? "Sem categoria";
  const visual = categoryVisual({
    slug: lead.category?.slug,
    name: lead.category?.name,
  });

  return (
    <Card className="flex flex-col gap-4 p-4 transition-shadow hover:shadow-md">
      {/* Cabeçalho: icon-chip da categoria + título/subtítulo + status. */}
      <div className="flex items-start gap-3">
        <IconChip icon={visual.icon} color={visual.color} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold tracking-tight">
            {lead.title}
          </h3>
          <p className="truncate text-sm text-muted-foreground">
            {categoryName}
          </p>
        </div>
        <LeadStatusBadge status={lead.status} />
      </div>

      {/* Metadados: local, custo, tipo, urgência. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-4 w-4" aria-hidden />
          {lead.city}
          {lead.state ? `/${lead.state}` : ""}
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium text-brand">
          <Coins className="h-4 w-4" aria-hidden />
          {lead.credits_cost}{" "}
          {lead.credits_cost === 1 ? "crédito" : "créditos"}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Tipo:{" "}
          <span className="font-medium text-foreground">
            {leadTypeLabel(lead.lead_type)}
          </span>
        </span>
        <span>
          Urgência:{" "}
          <span className="font-medium text-foreground">
            {leadUrgencyLabel(lead.urgency)}
          </span>
        </span>
      </div>

      {/* Ações. */}
      <div className="mt-auto flex flex-wrap gap-2 border-t pt-3">
        <Link
          href={`/leads/detalhe?id=${lead.id}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "inline-flex items-center gap-1.5"
          )}
        >
          {isOpen ? (
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Eye className="h-3.5 w-3.5" aria-hidden />
          )}
          {isOpen ? "Ver / editar" : "Ver detalhes"}
        </Link>
        {isOpen ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancel(lead)}
            className="inline-flex items-center gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Cancelar
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
