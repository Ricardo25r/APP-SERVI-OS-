/**
 * `PackageCard` — card de um pacote de créditos no catálogo.
 *
 * Mostra nome, quantidade de créditos e preço formatado em BRL (a partir de
 * `price_cents`), com um botão "Comprar". Apresentacional: a ação de compra é
 * delegada via `onBuy`. `loading` reflete a mutation de criação do pedido em
 * andamento para este pacote.
 */
"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{pkg.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        <div>
          <p className="text-3xl font-bold tabular-nums">
            {pkg.credits}
            <span className="ml-1.5 text-sm font-medium text-muted-foreground">
              créditos
            </span>
          </p>
          <p className="mt-1 text-xl font-semibold text-primary tabular-nums">
            {formatBRLFromCents(pkg.price_cents, pkg.currency)}
          </p>
        </div>

        <Button
          type="button"
          className="w-full"
          onClick={() => onBuy(pkg)}
          disabled={loading || disabled}
        >
          {loading && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          )}
          Comprar
        </Button>
      </CardContent>
    </Card>
  );
}
