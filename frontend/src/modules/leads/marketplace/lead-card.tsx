/**
 * `LeadCard` — um cartão de oportunidade no MARKETPLACE do profissional
 * (telas 03/04 — Home Profissional / Detalhes do lead).
 *
 * Mostra `IconChip` da categoria, título, cidade/UF, urgência e o custo em
 * créditos em destaque (badge). Botão "Comprar lead (N créditos)" laranja (CTA)
 * dispara `onBuy`. Ao comprar com sucesso, o contato liberado é exibido inline
 * (card verde) — controlado pelo pai via `purchasedContact`. NUNCA expõe o
 * contato antes da compra.
 *
 * Estados de erro por-card (402/403/409) são exibidos inline; quando for 402
 * (saldo insuficiente) mostramos um CTA para `/credits`.
 */
"use client";

import Link from "next/link";
import { ArrowRight, Coins, Loader2, MapPin, Ruler } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import { cn } from "@/lib/utils";
import type { Lead, LeadContact } from "@/types";

import { categoryVisual } from "../category-icon";
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
  const visual = categoryVisual({
    slug: lead.category?.slug,
    name: lead.category?.name,
  });

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
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        {/* Cabeçalho: IconChip da categoria + título/categoria. */}
        <div className="flex items-start gap-3">
          <IconChip
            icon={visual.icon}
            color={visual.color}
            size="md"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <Link
              href={`/marketplace/${lead.id}`}
              className="block truncate text-base font-bold tracking-tight hover:text-primary"
            >
              {lead.title}
            </Link>
            {lead.category?.name && (
              <p className="truncate text-xs font-medium text-muted-foreground">
                {lead.category.name}
              </p>
            )}
          </div>
        </div>

        {/* Pílulas: urgência + tipo exclusivo. */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={urgency.variant}>{urgency.label}</Badge>
          {lead.lead_type === "one_time" && (
            <Badge variant="outline">Exclusivo</Badge>
          )}
        </div>

        <p className="line-clamp-2 text-sm text-muted-foreground">
          {lead.description}
        </p>

        {/* Metadados: local + data. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {locationParts.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {locationParts.join(", ")}
            </span>
          )}
          {lead.distance_km != null && (
            <span className="inline-flex items-center gap-1.5">
              <Ruler className="h-3.5 w-3.5" aria-hidden />
              {lead.distance_km.toLocaleString("pt-BR")} km
            </span>
          )}
          <span>Publicado em {formatDate(lead.created_at)}</span>
        </div>

        {purchasedContact && (
          <ContactCard contact={purchasedContact} className="mt-1" />
        )}

        {error && !alreadyPurchased && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
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

        {/* Rodapé: custo em destaque + CTA. */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums",
              canAfford
                ? "bg-brand/10 text-brand"
                : "bg-destructive/10 text-destructive"
            )}
          >
            <Coins className="h-4 w-4" aria-hidden />
            {lead.credits_cost} créditos
          </span>

          {alreadyPurchased ? (
            <Button variant="outline" size="sm" disabled>
              Lead comprado
            </Button>
          ) : (
            <Button
              size="sm"
              className="gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
              onClick={() => onBuy(lead)}
              disabled={buying || !canAfford}
              title={!canAfford ? "Saldo insuficiente" : undefined}
            >
              {buying && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              )}
              {buying ? "Comprando..." : `Comprar lead (${lead.credits_cost})`}
            </Button>
          )}
        </div>

        <Link
          href={`/marketplace/${lead.id}`}
          className="inline-flex items-center gap-1 self-start text-xs font-semibold text-primary hover:underline"
        >
          Ver detalhes
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
}
