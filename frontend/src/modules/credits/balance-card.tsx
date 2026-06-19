/**
 * `BalanceCard` — exibe o saldo de créditos da carteira do profissional.
 *
 * Reutilizado tanto na tela de Créditos quanto no topo do Marketplace.
 * É puramente apresentacional: recebe `balance` (ou `null` enquanto carrega)
 * e um estado de loading. Ações (recarregar / ir para créditos) são opcionais.
 */
"use client";

import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BalanceCardProps {
  balance: number | null;
  loading?: boolean;
  /** Quando true, mostra um link para a tela de créditos. */
  showCreditsLink?: boolean;
  className?: string;
}

export function BalanceCard({
  balance,
  loading = false,
  showCreditsLink = false,
  className,
}: BalanceCardProps) {
  return (
    <Card className={cn("bg-muted/40", className)}>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Seu saldo
          </p>
          {loading ? (
            <div className="mt-1 h-8 w-24 animate-pulse rounded bg-muted" />
          ) : (
            <p className="mt-0.5 text-3xl font-bold tabular-nums">
              {balance ?? 0}
              <span className="ml-1.5 text-sm font-medium text-muted-foreground">
                créditos
              </span>
            </p>
          )}
        </div>

        {showCreditsLink && (
          <Link
            href="/credits"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Ver carteira e histórico
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
