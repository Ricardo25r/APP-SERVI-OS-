"use client";

/**
 * `PaymentsTable` — financeiro (admin).
 *
 * Mostra o resumo de receita (cards) + a lista paginada de pedidos com filtro
 * por status. Valores monetários derivados de centavos. Em telas estreitas a
 * tabela rola horizontalmente.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Loader2,
  RotateCcw,
  Search,
  TrendingUp,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";

import { confirmOrder, fetchPayments } from "../api";
import type { PaymentOrderStatus, PaymentsFilters } from "../types";
import {
  adminErrorMessage,
  formatBRL,
  formatCentsToBRL,
  formatDateTime,
  formatNumber,
  PAYMENT_STATUS_LABEL,
  paymentStatusVariant,
} from "../utils";
import { Pagination } from "./pagination";

export const paymentsKey = (filters: PaymentsFilters) =>
  ["admin", "payments", filters] as const;

export function PaymentsTable() {
  const [statusDraft, setStatusDraft] = useState<"" | PaymentOrderStatus>("");
  const [applied, setApplied] = useState<PaymentsFilters>({ page: 1 });

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: paymentsKey(applied),
    queryFn: () => fetchPayments(applied),
  });

  const queryClient = useQueryClient();
  const confirm = useMutation({
    mutationFn: (orderId: string) => confirmOrder(orderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
    },
  });

  function applyFilters(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setApplied({ status: statusDraft || undefined, page: 1 });
  }

  function clearFilters() {
    setStatusDraft("");
    setApplied({ page: 1 });
  }

  const hasFilters = Boolean(applied.status);
  const items = data?.items ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* Resumo de receita */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Receita
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand/10 text-brand">
              <TrendingUp className="h-5 w-5" aria-hidden />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums">
            {summary
              ? typeof summary.revenue_brl === "number"
                ? formatBRL(summary.revenue_brl)
                : formatCentsToBRL(summary.revenue_cents)
              : "—"}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Pedidos pagos
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums">
            {summary ? formatNumber(summary.paid_orders) : "—"}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Estornos
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <RotateCcw className="h-5 w-5" aria-hidden />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums">
            {summary ? formatNumber(summary.refunded_orders) : "—"}
          </p>
        </div>
      </div>

      {/* Filtro */}
      <form
        onSubmit={applyFilters}
        className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-end"
      >
        <div className="space-y-2">
          <Label htmlFor="payments-status">Status</Label>
          <Select
            id="payments-status"
            value={statusDraft}
            onChange={(e) =>
              setStatusDraft(e.target.value as "" | PaymentOrderStatus)
            }
            className="sm:w-48"
          >
            <SelectOption value="">Todos</SelectOption>
            <SelectOption value="pending">Pendente</SelectOption>
            <SelectOption value="paid">Pago</SelectOption>
            <SelectOption value="failed">Falhou</SelectOption>
            <SelectOption value="refunded">Estornado</SelectOption>
            <SelectOption value="cancelled">Cancelado</SelectOption>
          </Select>
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

      {/* Tabela */}
      <div>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span>Carregando pagamentos...</span>
          </div>
        ) : isError ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {adminErrorMessage(error, "Não foi possível carregar os pagamentos.")}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="text-base font-medium">Nenhum pagamento encontrado.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajuste os filtros e tente novamente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Referência</th>
                  <th className="px-4 py-3 font-medium">Provedor</th>
                  <th className="px-4 py-3 font-medium">Créditos</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((order) => (
                  <tr key={order.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {order.external_reference}
                    </td>
                    <td className="px-4 py-3 capitalize">{order.provider}</td>
                    <td className="px-4 py-3 tabular-nums">{order.credits}</td>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {formatCentsToBRL(order.amount_cents)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={paymentStatusVariant(order.status)}>
                        {PAYMENT_STATUS_LABEL[order.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDateTime(order.paid_at ?? order.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {order.status === "pending" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={confirm.isPending}
                          onClick={() => confirm.mutate(order.id)}
                        >
                          Confirmar
                        </Button>
                      ) : null}
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
    </div>
  );
}
