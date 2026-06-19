/**
 * CRÉDITOS (carteira) do profissional — `/credits` (tela 20 — Carteira).
 *
 * Mostra o saldo (`GET /credits/balance`) em um `BalanceCard` de destaque, dois
 * `StatCard` (créditos comprados/usados, derivados do histórico), a seção
 * "Comprar créditos" (Fase 6 — catálogo de pacotes + criação de pedido +
 * confirmação simulada em dev) e o "Histórico de movimentações"
 * (`GET /credits/history`) com `IconChip` por tipo e valor com sinal (+/-).
 *
 * Ao confirmar uma compra (modo dev), a `BuyCreditsSection` invalida as queries
 * do React Query e chama `onPaid`, que recarrega o saldo/histórico locais.
 *
 * Protegida: `useRequireAuth("professional")`.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { BalanceCard } from "@/components/ui/balance-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/hooks/use-auth";
import { apiGet } from "@/services/api";
import type {
  CreditTransaction,
  CreditWallet,
  Paginated,
} from "@/types";

import { TransactionList } from "@/modules/credits/transaction-list";
import {
  messageFromError,
  summarizeTransactions,
} from "@/modules/credits/utils";
import { BuyCreditsSection } from "@/modules/payments";

export default function CreditsPage() {
  const auth = useRequireAuth("professional");

  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Âncora para rolar até a seção "Comprar créditos" ao clicar no CTA do card.
  const buyRef = useRef<HTMLDivElement>(null);

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

  const { purchased, used } = useMemo(
    () => summarizeTransactions(transactions),
    [transactions]
  );
  const hasSummary = transactions.length > 0;

  function scrollToBuy() {
    buyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!auth.hasHydrated || auth.role !== "professional") {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Carteira
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use seus créditos para comprar leads no marketplace.
        </p>
      </header>

      {/* Saldo em destaque (BalanceCard azul → navy). */}
      <BalanceCard
        className="mb-4"
        label="Saldo atual"
        value={
          loading ? (
            <span className="inline-block h-8 w-24 animate-pulse rounded bg-primary-foreground/20 align-middle" />
          ) : (
            <span className="tabular-nums">
              {balance ?? 0}
              <span className="ml-1.5 text-base font-semibold text-primary-foreground/80">
                créditos
              </span>
            </span>
          )
        }
        caption="Disponível para comprar leads"
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => void load()}
              disabled={loading}
            >
              <ArrowDownToLine className="h-4 w-4" aria-hidden />
              Transferir
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
              onClick={scrollToBuy}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Comprar créditos
            </Button>
          </>
        }
      />

      {/* Métricas derivadas do histórico (comprados / usados). */}
      {hasSummary && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4">
          <StatCard
            label="Créditos comprados"
            value={
              <span className="tabular-nums text-success">+{purchased}</span>
            }
            icon={TrendingUp}
            iconColor="green"
          />
          <StatCard
            label="Créditos usados"
            value={
              <span className="tabular-nums text-destructive">-{used}</span>
            }
            icon={TrendingDown}
            iconColor="orange"
          />
        </div>
      )}

      {/* Comprar créditos (catálogo de pacotes — lógica intacta). */}
      <div ref={buyRef} className="mb-8 scroll-mt-6">
        <BuyCreditsSection onPaid={() => void load()} />
      </div>

      {/* Histórico de movimentações. */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <SectionHeader
            title="Histórico de movimentações"
            className="mb-4"
          />

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-lg bg-muted/50"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              <p>{error}</p>
              <Button
                variant="outline"
                size="sm"
                className={cn("mt-3 gap-1.5")}
                onClick={() => void load()}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
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
