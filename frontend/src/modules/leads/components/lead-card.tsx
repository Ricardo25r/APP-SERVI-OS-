"use client";

import Link from "next/link";
import { Coins, MapPin, Pencil, Trash2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Lead } from "@/types";

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

  return (
    <Card className="flex flex-col">
      <CardHeader className="gap-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg">{lead.title}</CardTitle>
          <LeadStatusBadge status={lead.status} />
        </div>
        <p className="text-sm text-muted-foreground">{categoryName}</p>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4" aria-hidden />
            {lead.city}
            {lead.state ? `/${lead.state}` : ""}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Coins className="h-4 w-4" aria-hidden />
            {lead.credits_cost} {lead.credits_cost === 1 ? "crédito" : "créditos"}
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

        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Link
            href={`/leads/${lead.id}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "inline-flex items-center gap-1.5"
            )}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            {isOpen ? "Ver / editar" : "Ver detalhes"}
          </Link>
          {isOpen ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onCancel(lead)}
              className="inline-flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Cancelar
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
