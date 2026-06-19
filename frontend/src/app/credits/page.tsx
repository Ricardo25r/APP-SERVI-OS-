/**
 * CRÉDITOS (carteira) do profissional — `/credits`.
 *
 * Mostra o saldo (`GET /credits/balance`) e o histórico de transações
 * (`GET /credits/history`) com tipo (bonus/spend/...), valor (+/-) e data.
 *
 * Nota: a compra REAL de créditos é Fase 6. Por ora, os créditos são
 * concedidos pelo admin — a tela explica isso ao usuário.
 *
 * Protegida: `useRequireAuth("professional")`.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRequireAuth } from "@/hooks/use-auth";
import { apiGet } from "@/services/api";
import type {
  CreditTransaction,
  CreditWallet,
  Paginated,
} from "@/types";

import { BalanceCard } from "@/modules/credits/balance-card";
import { TransactionList } from "@/modules/credits/transaction-list";
import { messageFromError } from "@/modules/credits/utils";

export default function CreditsPage() {
  const auth = useRequireAuth("professional");

  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [wallet, history] = await Promise.all([
        apiGet<CreditWallet>("/credits/balance"),
        apiGet<CreditTransaction[] | Paginated<CreditTransaction>>(
          "/credits/history"
        ),
      ]);
      setBalance(wallet.balance ?? 0);
      setTransactions(
        Array.isArray(history) ? history : history.items ?? []
      );
    } catch (err) {
      setError(messageFromError(err));
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
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus créditos</h1>
          <p className="mt-1 text-muted-foreground">
            Use seus créditos para comprar leads no marketplace.
          </p>
        </div>
        <Link
          href="/marketplace"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Ir para o marketplace
        </Link>
      </header>

      <BalanceCard balance={balance} loading={loading} className="mb-6" />

      <div className="mb-8 rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        A compra de créditos estará disponível em breve. Por enquanto, os
        créditos são concedidos pela administração do TrampoJá.
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-xl">Histórico de transações</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded bg-muted/50"
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
            <TransactionList transactions={transactions} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
