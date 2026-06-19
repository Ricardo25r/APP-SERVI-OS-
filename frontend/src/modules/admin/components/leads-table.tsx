"use client";

/**
 * `LeadsTable` — moderação de leads (admin).
 *
 * Filtros por status/categoria/cidade. Ação de cancelar lead (com confirmação
 * e motivo opcional). Categorias carregadas via `/categories/?active=false`
 * para popular o filtro. Em telas estreitas a tabela rola horizontalmente.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Loader2, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { LeadStatus } from "@/types";

import { cancelLead, fetchAllCategories, fetchLeads } from "../api";
import type { AdminLead, LeadsFilters } from "../types";
import {
  adminErrorMessage,
  formatDateTime,
  LEAD_STATUS_LABEL,
  LEAD_TYPE_LABEL,
  leadStatusVariant,
  shortId,
} from "../utils";
import { ConfirmDialog } from "./confirm-dialog";
import { Pagination } from "./pagination";

export const leadsKey = (filters: LeadsFilters) =>
  ["admin", "leads", filters] as const;

export function LeadsTable() {
  const queryClient = useQueryClient();

  const [statusDraft, setStatusDraft] = useState<"" | LeadStatus>("");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [cityDraft, setCityDraft] = useState("");
  const [applied, setApplied] = useState<LeadsFilters>({ page: 1 });

  const [pending, setPending] = useState<AdminLead | null>(null);
  const [reason, setReason] = useState("");

  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories", "all"],
    queryFn: fetchAllCategories,
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: leadsKey(applied),
    queryFn: () => fetchLeads(applied),
  });

  const mutation = useMutation({
    mutationFn: (lead: AdminLead) => cancelLead(lead.id, reason.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "leads"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
      closeDialog();
    },
  });

  function applyFilters(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setApplied({
      status: statusDraft || undefined,
      category_id: categoryDraft || undefined,
      city: cityDraft.trim() || undefined,
      page: 1,
    });
  }

  function clearFilters() {
    setStatusDraft("");
    setCategoryDraft("");
    setCityDraft("");
    setApplied({ page: 1 });
  }

  function closeDialog() {
    if (mutation.isPending) return;
    setPending(null);
    setReason("");
    mutation.reset();
  }

  const hasFilters = Boolean(
    applied.status || applied.category_id || applied.city
  );
  const items = data?.items ?? [];
  const categories = categoriesQuery.data ?? [];
  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? shortId(id);

  return (
    <div>
      <form
        onSubmit={applyFilters}
        className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"
      >
        <div className="space-y-2">
          <Label htmlFor="leads-status">Status</Label>
          <Select
            id="leads-status"
            value={statusDraft}
            onChange={(e) => setStatusDraft(e.target.value as "" | LeadStatus)}
          >
            <SelectOption value="">Todos</SelectOption>
            <SelectOption value="open">Aberto</SelectOption>
            <SelectOption value="purchased">Comprado</SelectOption>
            <SelectOption value="closed">Encerrado</SelectOption>
            <SelectOption value="cancelled">Cancelado</SelectOption>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="leads-category">Categoria</Label>
          <Select
            id="leads-category"
            value={categoryDraft}
            onChange={(e) => setCategoryDraft(e.target.value)}
          >
            <SelectOption value="">Todas</SelectOption>
            {categories.map((c) => (
              <SelectOption key={c.id} value={c.id}>
                {c.name}
              </SelectOption>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="leads-city">Cidade</Label>
          <Input
            id="leads-city"
            placeholder="Ex.: Ariquemes"
            value={cityDraft}
            onChange={(e) => setCityDraft(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit">
            <Search className="mr-2 h-4 w-4" aria-hidden />
            Filtrar
          </Button>
          {hasFilters && (
            <Button type="button" variant="outline" onClick={clearFilters}>
              <X className="mr-2 h-4 w-4" aria-hidden />
              Limpar
            </Button>
          )}
        </div>
      </form>

      <div className="mt-6">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span>Carregando leads...</span>
          </div>
        ) : isError ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {adminErrorMessage(error, "Não foi possível carregar os leads.")}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="text-base font-medium">Nenhum lead encontrado.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajuste os filtros e tente novamente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Título</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Local</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Custo</th>
                  <th className="px-4 py-3 font-medium">Criado</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((lead) => (
                  <tr key={lead.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{lead.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {LEAD_TYPE_LABEL[lead.lead_type]}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {categoryName(lead.category_id)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {lead.city}/{lead.state}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={leadStatusVariant(lead.status)}>
                        {LEAD_STATUS_LABEL[lead.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {lead.credits_cost} cr.
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDateTime(lead.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={lead.status === "cancelled"}
                          onClick={() => {
                            setReason("");
                            mutation.reset();
                            setPending(lead);
                          }}
                        >
                          <Ban className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                          Cancelar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && (
          <Pagination
            page={data.page}
            pageSize={data.page_size}
            total={data.total}
            loading={isFetching}
            onPageChange={(page) => setApplied((p) => ({ ...p, page }))}
          />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        title="Cancelar lead?"
        description={
          pending
            ? `O lead "${pending.title}" será cancelado e deixará de receber propostas.`
            : undefined
        }
        confirmLabel="Sim, cancelar"
        confirmVariant="destructive"
        loading={mutation.isPending}
        error={
          mutation.isError
            ? adminErrorMessage(mutation.error, "Não foi possível cancelar o lead.")
            : null
        }
        onConfirm={() => pending && mutation.mutate(pending)}
        onCancel={closeDialog}
      >
        <div className="space-y-2">
          <Label htmlFor="lead-cancel-reason">Motivo (opcional)</Label>
          <Textarea
            id="lead-cancel-reason"
            placeholder="Descreva o motivo do cancelamento"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
