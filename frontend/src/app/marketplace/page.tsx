/**
 * MARKETPLACE do profissional — `/marketplace`.
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

import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/use-auth";
import { apiGet, apiPost } from "@/services/api";
import type {
  CreditWallet,
  Lead,
  LeadContact,
  LeadPurchase,
  Paginated,
} from "@/types";

import { BalanceCard } from "@/modules/credits/balance-card";
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
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
          <p className="mt-1 text-muted-foreground">
            Oportunidades elegíveis para o seu perfil. Compre o lead para
            liberar o contato do contratante.
          </p>
        </div>
        <Link
          href="/purchases"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Minhas compras
        </Link>
      </header>

      <BalanceCard
        balance={balance}
        loading={balanceLoading}
        showCreditsLink
        className="mb-8"
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-lg border bg-muted/40"
            />
          ))}
        </div>
      ) : loadError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <p>{loadError}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void loadLeads()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma oportunidade elegível no momento. Verifique se as
            categorias e a cidade do seu perfil estão atualizadas.
          </p>
        </div>
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
