/**
 * `PackageCard` — card de um pacote de créditos no catálogo (tela 05 — Comprar
 * créditos).
 *
 * Mostra nome, quantidade de créditos e preço formatado em BRL (a partir de
 * `price_cents`), com um botão "Comprar" laranja (CTA). Apresentacional: a ação
 * de compra é delegada via `onBuy`. `loading` reflete a mutation de criação do
 * pedido em andamento para este pacote.
 */
"use client";

import { Coins, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";

import type { CreditPackage } from "../types";
import { formatBRLFromCents } from "../utils";

interface PackageCardProps {
  pkg: CreditPackage;
  onBuy: (pkg: CreditPackage) => void;
  /** Mutation de compra em andamento para ESTE pacote. */
  loading?: boolean;
  /** Desabilita o botão (ex.: outra compra em andamento). */
  disabled?: boolean;
}

export function PackageCard({
  pkg,
  onBuy,
  loading = false,
  disabled = false,
}: PackageCardProps) {
  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {pkg.name}
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
              {pkg.credits}
              <span className="ml-1.5 text-sm font-medium text-muted-foreground">
                créditos
              </span>
            </p>
          </div>
          <IconChip icon={Coins} color="orange" size="md" aria-hidden />
        </div>

        <p className="text-lg font-bold tabular-nums text-primary">
          {formatBRLFromCents(pkg.price_cents, pkg.currency)}
        </p>

        <Button
          type="button"
          className="mt-auto w-full gap-2 bg-brand text-brand-foreground hover:bg-brand/90"
          onClick={() => onBuy(pkg)}
          disabled={loading || disabled}
        >
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          )}
          Comprar
        </Button>
      </CardContent>
    </Card>
  );
}
