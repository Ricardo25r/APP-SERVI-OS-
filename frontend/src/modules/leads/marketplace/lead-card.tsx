/**
 * `LeadCard` — um cartão de oportunidade no MARKETPLACE do profissional.
 *
 * Mostra título, categoria, cidade/bairro, urgência e custo em créditos (Badge).
 * Botão "Comprar lead (N créditos)" dispara `onBuy`. Ao comprar com sucesso,
 * o contato liberado é exibido inline (card verde) — controlado pelo pai via
 * `purchasedContact`. NUNCA expõe contato antes da compra.
 *
 * Estados de erro por-card (402/403/409) são exibidos inline; quando for 402
 * (saldo insuficiente) mostramos um CTA para `/credits`.
 */
"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Lead, LeadContact } from "@/types";

import { ContactCard } from "./contact-card";
import { formatDate, urgencyMeta, type PurchaseErrorInfo } from "./utils";

interface LeadCardProps {
  lead: Lead;
  /** Saldo atual do profissional (para destacar quando não dá pra pagar). */
  balance: number | null;
  /** True enquanto a compra deste lead está em andamento. */
  buying: boolean;
  /** Contato liberado após compra bem-sucedida (mostra o card verde). */
  purchasedContact?: LeadContact;
  /** Erro da última tentativa de compra deste lead. */
  error?: PurchaseErrorInfo | null;
  onBuy: (lead: Lead) => void;
}

export function LeadCard({
  lead,
  balance,
  buying,
  purchasedContact,
  error,
  onBuy,
}: LeadCardProps) {
  const urgency = urgencyMeta(lead.urgency);

  // Prioriza a flag do backend; se ausente, infere pelo saldo conhecido.
  const canAfford =
    lead.affordable ??
    (balance === null ? true : balance >= lead.credits_cost);

  const alreadyPurchased = Boolean(purchasedContact);
  const locationParts = [lead.neighborhood, lead.city, lead.state].filter(
    Boolean
  );

  return (
    <Card className="flex flex-col">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {lead.category?.name && (
            <Badge variant="secondary">{lead.category.name}</Badge>
          )}
          <Badge variant={urgency.variant}>{urgency.label}</Badge>
          {lead.lead_type === "one_time" && (
            <Badge variant="outline">Exclusivo</Badge>
          )}
        </div>
        <CardTitle className="text-lg">{lead.title}</CardTitle>
      </CardHeader>

      <CardContent className="flex-1 space-y-2">
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {lead.description}
        </p>
        <dl className="space-y-1 text-sm">
          {locationParts.length > 0 && (
            <div className="flex gap-1">
              <dt className="text-muted-foreground">Local:</dt>
              <dd>{locationParts.join(", ")}</dd>
            </div>
          )}
          <div className="flex gap-1">
            <dt className="text-muted-foreground">Publicado em:</dt>
            <dd>{formatDate(lead.created_at)}</dd>
          </div>
        </dl>

        {purchasedContact && (
          <ContactCard contact={purchasedContact} className="mt-3" />
        )}

        {error && !alreadyPurchased && (
          <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <p>{error.message}</p>
            {error.offerCredits && (
              <Link
                href="/credits"
                className="mt-1 inline-block font-medium underline underline-offset-4"
              >
                Adicionar créditos
              </Link>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Custo:</span>
          <Badge variant={canAfford ? "default" : "destructive"}>
            {lead.credits_cost} créditos
          </Badge>
        </div>

        {alreadyPurchased ? (
          <Button variant="outline" disabled>
            Lead comprado
          </Button>
        ) : (
          <Button
            onClick={() => onBuy(lead)}
            disabled={buying || !canAfford}
            title={!canAfford ? "Saldo insuficiente" : undefined}
          >
            {buying
              ? "Comprando..."
              : `Comprar lead (${lead.credits_cost} créditos)`}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
