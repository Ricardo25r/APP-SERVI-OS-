"use client";

/**
 * Lista as solicitações (leads) do contratante autenticado.
 * Protegida para o papel `customer`. Permite criar uma nova solicitação,
 * ver/editar (enquanto aberta) e cancelar (com confirmação).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, Plus, RefreshCw } from "lucide-react";

import { AppHeader } from "@/components/app-shell/app-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/hooks/use-auth";
import type { Lead, LeadStatus } from "@/types";

import {
  cancelLead,
  ConfirmDialog,
  describeApiError,
  fetchMyLeads,
  leadStatusLabel,
  LeadCard,
} from "@/modules/leads";

/** Filtros disponíveis (segmented). */
const STATUS_FILTERS: { value: "all" | LeadStatus; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "open", label: leadStatusLabel("open") },
  { value: "purchased", label: leadStatusLabel("purchased") },
  { value: "closed", label: leadStatusLabel("closed") },
  { value: "cancelled", label: leadStatusLabel("cancelled") },
];

export default function LeadsPage() {
  const auth = useRequireAuth("customer");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | LeadStatus>("all");

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

  const filtered = useMemo(
    () =>
      filter === "all" ? leads : leads.filter((l) => l.status === filter),
    [leads, filter]
  );

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
    <>
      {/* Header azul interno (mobile) — no desktop usa o SiteHeader. */}
      <AppHeader
        mode="title"
        title="Solicitações"
        backHref="/"
        className="lg:hidden"
        action={
          <Link
            href="/leads/new"
            aria-label="Nova solicitação"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground/90 transition-colors hover:bg-primary-foreground/10"
          >
            <Plus className="h-5 w-5" aria-hidden />
          </Link>
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Título + CTA (desktop). */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Suas solicitações
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie as solicitações de serviço que você publicou.
            </p>
          </div>
          <Link
            href="/leads/new"
            className={cn(
              buttonVariants(),
              "gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
            )}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Nova solicitação
          </Link>
        </div>

        {/* Filtro segmented por status. */}
        {!loading && !error && leads.length > 0 ? (
          <div className="mt-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="inline-flex gap-1 rounded-full bg-muted p-1">
              {STATUS_FILTERS.map((f) => {
                const active = filter === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFilter(f.value)}
                    aria-pressed={active}
                    className={cn(
                      "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-6">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-48 animate-pulse rounded-lg border bg-muted/40"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-center">
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
            <EmptyState
              icon={ClipboardList}
              title="Você ainda não tem solicitações."
              description="Crie sua primeira solicitação para receber propostas de profissionais."
              action={
                <Link
                  href="/leads/new"
                  className={cn(
                    buttonVariants(),
                    "gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
                  )}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Nova solicitação
                </Link>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Nenhuma solicitação neste filtro."
              description="Tente selecionar outro status acima."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilter("all")}
                >
                  Ver todas
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((lead) => (
                <LeadCard key={lead.id} lead={lead} onCancel={setToCancel} />
              ))}
            </div>
          )}
        </div>
      </main>

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
    </>
  );
}
