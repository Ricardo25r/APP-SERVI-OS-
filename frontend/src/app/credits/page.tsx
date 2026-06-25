/**
 * CRÉDITOS (carteira) do profissional — `/credits` (Tela 05 — Comprar créditos).
 *
 * - Card "Seus créditos" com saldo (`GET /credits/balance`) + ilustração da
 *   carteira.
 * - "Comprar créditos" (`BuyCreditsSection`): catálogo de pacotes selecionável +
 *   forma de pagamento + CTA "Continuar com Pix" (Fase 6).
 * - "Histórico de movimentações" (`GET /credits/history`).
 *
 * Protegida: `useRequireAuth("professional")`.
 */
"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { useRequireAuth } from "@/hooks/use-auth";
import { useIsNativeApp } from "@/hooks/use-native-app";
import { apiGet } from "@/services/api";
import type { CreditTransaction, CreditWallet, Paginated } from "@/types";

import { TransactionList } from "@/modules/credits/transaction-list";
import { messageFromError } from "@/modules/credits/utils";
import { BuyCreditsSection } from "@/modules/payments";
import { ProPlanCard } from "@/modules/payments/pro-plan-card";
import { Testimonials } from "@/modules/reviews/testimonials";

// Beta: quando NEXT_PUBLIC_PAYMENTS_ENABLED=false, a compra fica oculta
// (o backend também recusa criar pedido). Default = habilitado.
const paymentsEnabled = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED !== "false";

export default function CreditsPage() {
  const auth = useRequireAuth("professional");
  // No app nativo Android a compra fica oculta (política de pagamentos do
  // Google Play). A venda continua no site/PWA. Spending de crédito é liberado.
  const isNativeApp = useIsNativeApp();
  const showPurchase = paymentsEnabled && !isNativeApp;

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
      setTransactions(Array.isArray(history) ? history : history.items ?? []);
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
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {showPurchase ? "Comprar créditos" : "Créditos"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use seus créditos para desbloquear leads no marketplace.
        </p>
      </header>

      {/* Seus créditos (saldo + carteira) */}
      <Card className="overflow-hidden border-primary/15 bg-primary/5">
        <CardContent className="flex items-center justify-between gap-4 p-5 sm:p-6">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">
              Seus créditos
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
              {loading ? (
                <span className="inline-block h-8 w-24 animate-pulse rounded bg-muted align-middle" />
              ) : (
                <>
                  {balance ?? 0}
                  <span className="ml-1.5 text-base font-medium text-muted-foreground">
                    créditos
                  </span>
                </>
              )}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Saldo disponível
            </p>
          </div>
          <Image
            src="/brand/carteira.png"
            alt="Carteira FazTudo"
            width={96}
            height={96}
            priority
            className="h-20 w-20 shrink-0 object-contain sm:h-24 sm:w-24"
          />
        </CardContent>
      </Card>

      {/* Plano PRO (assinatura). Só aparece quando o admin liga e fora do app
          Android (política da loja). #56 */}
      <ProPlanCard />

      {/* Comprar créditos (catálogo + pagamento). Oculto no beta e no app
          nativo (Android) — compra fica no site, por política da loja. */}
      {showPurchase ? (
        <BuyCreditsSection onPaid={() => void load()} />
      ) : isNativeApp ? (
        <Card className="border-dashed">
          <CardContent className="space-y-1 p-5 text-center sm:p-6">
            <p className="text-sm font-semibold text-foreground">
              Compra de créditos pelo site
            </p>
            <p className="text-sm text-muted-foreground">
              Para adicionar créditos, acesse o FazTudo pelo navegador em{" "}
              <span className="font-medium text-foreground">
                faztudoapp.com.br
              </span>
              . Aqui no app você usa seus créditos normalmente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="space-y-1 p-5 text-center sm:p-6">
            <p className="text-sm font-semibold text-foreground">
              Compra de créditos chegando em breve
            </p>
            <p className="text-sm text-muted-foreground">
              Durante o beta, profissionais já começam com créditos de cortesia
              para desbloquear contatos. Em breve você poderá comprar mais.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Histórico de movimentações. */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <SectionHeader title="Histórico de movimentações" className="mb-4" />

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
                className="mt-3 gap-1.5"
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

      <Testimonials title="Quem usa, recomenda" />
    </main>
  );
}
