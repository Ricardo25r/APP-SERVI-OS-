/**
 * MINHAS COMPRAS — `/purchases`.
 *
 * Histórico de leads comprados pelo profissional (`GET /lead-purchases/`).
 * Como a compra já foi concluída, cada item exibe o contato do contratante.
 *
 * Protegida: `useRequireAuth("professional")`.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/use-auth";
import { apiGet } from "@/services/api";
import type { LeadPurchase, Paginated } from "@/types";

import { PurchaseList } from "@/modules/leads/marketplace/purchase-list";
import { loadErrorMessage } from "@/modules/leads/marketplace/utils";

export default function PurchasesPage() {
  const auth = useRequireAuth("professional");

  const [purchases, setPurchases] = useState<LeadPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<LeadPurchase[] | Paginated<LeadPurchase>>(
        "/lead-purchases/"
      );
      setPurchases(Array.isArray(data) ? data : data.items ?? []);
    } catch (err) {
      setError(loadErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auth.isAuthenticated || auth.role !== "professional") return;
    void load();
  }, [auth.isAuthenticated, auth.role, load]);

  if (!auth.hasHydrated || auth.role !== "professional") {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  const totalLeads = purchases.length;
  const creditsSpent = purchases.reduce(
    (s, p) => s + (p.credits_used ?? 0),
    0
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Minhas compras</h1>
          <p className="mt-1 text-muted-foreground">
            Leads que você comprou, com o contato do contratante.
          </p>
        </div>
        <Link
          href="/marketplace"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Ir para o marketplace
        </Link>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-lg border bg-muted/40"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <p>{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void load()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:max-w-md">
            <div className="rounded-xl bg-secondary p-4">
              <p className="text-xs text-muted-foreground">
                Leads desbloqueados
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                {totalLeads}
              </p>
            </div>
            <div className="rounded-xl bg-secondary p-4">
              <p className="text-xs text-muted-foreground">Créditos gastos</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                {creditsSpent}
              </p>
            </div>
          </div>
          <PurchaseList purchases={purchases} />
        </>
      )}
    </main>
  );
}
