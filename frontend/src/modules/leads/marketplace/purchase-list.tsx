/**
 * `PurchaseList` — histórico de compras de leads do profissional
 * (`GET /lead-purchases/`). Cada item mostra o lead comprado e o contato
 * do contratante liberado (já que a compra foi concluída).
 */
"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LeadPurchase } from "@/types";

import { ContactCard } from "./contact-card";
import { DisputeButton } from "./dispute-button";
import { formatDate } from "./utils";

interface PurchaseListProps {
  purchases: LeadPurchase[];
}

export function PurchaseList({ purchases }: PurchaseListProps) {
  if (purchases.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Você ainda não comprou nenhum lead.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {purchases.map((purchase) => {
        const lead = purchase.lead;
        const contact = purchase.contact ?? lead?.contact;
        return (
          <Card key={purchase.id} className="flex flex-col">
            <CardHeader className="gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {lead?.category?.name && (
                  <Badge variant="secondary">{lead.category.name}</Badge>
                )}
                <Badge variant="outline">
                  {purchase.credits_used} créditos
                </Badge>
              </div>
              <CardTitle className="text-base">
                {lead?.title ?? "Lead comprado"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              {lead?.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {lead.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Comprado em {formatDate(purchase.purchased_at)}
              </p>
              {contact && <ContactCard contact={contact} />}
              <div className="pt-1">
                <DisputeButton purchaseId={purchase.id} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
