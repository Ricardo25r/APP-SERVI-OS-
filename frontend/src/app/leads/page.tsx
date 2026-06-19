"use client";

/**
 * Lista as solicitações (leads) do contratante autenticado.
 * Protegida para o papel `customer`. Permite criar uma nova solicitação,
 * ver/editar (enquanto aberta) e cancelar (com confirmação).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/hooks/use-auth";
import type { Lead } from "@/types";

import {
  cancelLead,
  ConfirmDialog,
  describeApiError,
  fetchMyLeads,
  LeadCard,
} from "@/modules/leads";

export default function LeadsPage() {
  const auth = useRequireAuth("customer");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado do diálogo de cancelamento.
  const [toCancel, setToCancel] = useState<Lead | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyLeads();
      setLeads(data);
    } catch (err) {
      setError(describeApiError(err, "Não foi possível carregar suas solicitações."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Só busca após hidratar e confirmar o papel correto.
    if (!auth.hasHydrated || !auth.isAuthenticated || !auth.isCustomer) return;
    void load();
  }, [auth.hasHydrated, auth.isAuthenticated, auth.isCustomer, load]);

  async function handleConfirmCancel() {
    if (!toCancel) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelLead(toCancel.id);
      setLeads((prev) =>
        prev.map((l) =>
          l.id === toCancel.id ? { ...l, status: "cancelled" } : l
        )
      );
      setToCancel(null);
    } catch (err) {
      setCancelError(describeApiError(err, "Não foi possível cancelar a solicitação."));
    } finally {
      setCancelling(false);
    }
  }

  // Enquanto a sessão não hidrata, evita flicker de conteúdo protegido.
  if (!auth.hasHydrated) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Minhas solicitações
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie as solicitações de serviço que você publicou.
          </p>
        </div>
        <Link href="/leads/new" className={cn(buttonVariants(), "gap-1.5")}>
          <Plus className="h-4 w-4" aria-hidden />
          Nova solicitação
        </Link>
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-lg border bg-muted/40"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-1.5"
              onClick={() => void load()}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Tentar novamente
            </Button>
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="text-base font-medium">
              Você ainda não tem solicitações.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie sua primeira solicitação para receber propostas de
              profissionais.
            </p>
            <Link
              href="/leads/new"
              className={cn(buttonVariants(), "mt-4 gap-1.5")}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Nova solicitação
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onCancel={setToCancel} />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toCancel)}
        title="Cancelar solicitação?"
        description={
          toCancel
            ? `A solicitação "${toCancel.title}" será cancelada e deixará de receber propostas.`
            : undefined
        }
        confirmLabel="Sim, cancelar"
        cancelLabel="Voltar"
        confirmVariant="destructive"
        loading={cancelling}
        error={cancelError}
        onConfirm={() => void handleConfirmCancel()}
        onCancel={() => {
          if (cancelling) return;
          setToCancel(null);
          setCancelError(null);
        }}
      />
    </main>
  );
}
