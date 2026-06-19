/**
 * MARKETPLACE do profissional — `/marketplace` (telas 03/04).
 *
 * Lista as oportunidades ELEGÍVEIS (`GET /leads/` como professional: mesma
 * categoria/cidade do perfil, status open) e permite COMPRAR um lead
 * (`POST /lead-purchases/`). Em sucesso (201), o contato do contratante é
 * liberado e exibido inline no próprio card. Trata 402 (saldo insuficiente,
 * com link para /credits), 403 (inelegível) e 409 (lead exclusivo já comprado).
 *
 * Mostra o saldo atual no topo (`GET /credits/balance`) e link para /credits.
 *
 * Protegida: `useRequireAuth("professional")`.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, SearchX, Wallet } from "lucide-react";

import { BalanceCard } from "@/components/ui/balance-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/hooks/use-auth";
import { apiGet, apiPost } from "@/services/api";
import type {
  CreditWallet,
  Lead,
  LeadContact,
  LeadPurchase,
  Paginated,
} from "@/types";

import { LeadCard } from "@/modules/leads/marketplace/lead-card";
import {
  loadErrorMessage,
  normalizeLeadsResponse,
  purchaseErrorMessage,
  type PurchaseErrorInfo,
} from "@/modules/leads/marketplace/utils";

export default function MarketplacePage() {
  const auth = useRequireAuth("professional");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Estados por-lead (compra em andamento / contato liberado / erro).
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Record<string, LeadContact>>({});
  const [errors, setErrors] = useState<Record<string, PurchaseErrorInfo>>({});

  const loadBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const wallet = await apiGet<CreditWallet>("/credits/balance");
      setBalance(wallet.balance ?? 0);
    } catch {
      // Saldo é informativo; não bloqueia o marketplace.
      setBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiGet<Lead[] | Paginated<Lead>>("/leads/");
      setLeads(normalizeLeadsResponse(data));
    } catch (err) {
      setLoadError(loadErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auth.isAuthenticated || auth.role !== "professional") return;
    void loadBalance();
    void loadLeads();
  }, [auth.isAuthenticated, auth.role, loadBalance, loadLeads]);

  const handleBuy = useCallback(
    async (lead: Lead) => {
      setBuyingId(lead.id);
      setErrors((prev) => {
        const next = { ...prev };
        delete next[lead.id];
        return next;
      });

      try {
        const purchase = await apiPost<LeadPurchase>("/lead-purchases/", {
          lead_id: lead.id,
        });
        const contact = purchase.contact ?? purchase.lead?.contact;
        if (contact) {
          setContacts((prev) => ({ ...prev, [lead.id]: contact }));
        }
        // Atualiza saldo após o débito.
        void loadBalance();
      } catch (err) {
        setErrors((prev) => ({
          ...prev,
          [lead.id]: purchaseErrorMessage(err),
        }));
      } finally {
        setBuyingId(null);
      }
    },
    [loadBalance]
  );

  // Enquanto a auth não hidratou, evita flicker.
  if (!auth.hasHydrated || auth.role !== "professional") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Oportunidades
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compre o lead para liberar o contato do contratante.
        </p>
      </header>

      {/* Saldo no topo com link para a carteira. */}
      <BalanceCard
        className="mb-8"
        label="Seu saldo"
        value={
          balanceLoading ? (
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
        caption="Use seus créditos para comprar leads"
        actions={
          <Link
            href="/credits"
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "gap-1.5"
            )}
          >
            <Wallet className="h-4 w-4" aria-hidden />
            Ver carteira
          </Link>
        }
      />

      <SectionHeader
        title="Leads disponíveis"
        actionLabel="Minhas compras"
        actionHref="/purchases"
        className="mb-4"
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-xl border bg-muted/40"
            />
          ))}
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 gap-1.5"
            onClick={() => void loadLeads()}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Tentar novamente
          </Button>
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Nenhuma oportunidade no momento"
          description="Verifique se as categorias e a cidade do seu perfil estão atualizadas para receber mais leads elegíveis."
          action={
            <Link
              href="/profile"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Atualizar perfil
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              balance={balance}
              buying={buyingId === lead.id}
              purchasedContact={contacts[lead.id]}
              error={errors[lead.id] ?? null}
              onBuy={handleBuy}
            />
          ))}
        </div>
      )}
    </main>
  );
}
