"use client";

/**
 * `MetricCards` — grade de KPIs do dashboard admin (`GET /admin/metrics`).
 *
 * Lê as métricas via React Query e renderiza cartões agrupados (usuários,
 * leads, financeiro, engajamento). Trata o shape defensivamente (campos podem
 * vir como objeto `{total,...}` ou contagem simples — ver `safeCount`).
 */

import { useQuery } from "@tanstack/react-query";
import {
  CreditCard,
  Loader2,
  MessageSquare,
  Star,
  Users,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { fetchMetrics } from "../api";
import type { AdminMetrics } from "../types";
import { adminErrorMessage, formatBRL, formatNumber, safeCount } from "../utils";

export const metricsKey = ["admin", "metrics"] as const;

interface MetricItem {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: boolean;
}

function buildMetrics(m: AdminMetrics): MetricItem[] {
  const users = m.users ?? null;
  const usersTotal = safeCount(users);
  const customers = safeCount(m.customers) || safeCount(users?.customer);
  const professionals =
    safeCount(m.professionals) || safeCount(users?.professional);

  const leads = m.leads ?? null;
  const leadsTotal = safeCount(leads);
  const leadsOpen = safeCount(leads?.open);

  const finance = m.finance ?? null;
  const revenue =
    typeof finance?.revenue_brl === "number"
      ? finance.revenue_brl
      : safeCount(finance?.revenue_cents) / 100;
  const paidOrders = safeCount(finance?.paid_orders);

  return [
    {
      label: "Usuários",
      value: formatNumber(usersTotal),
      hint: `${formatNumber(customers)} contratantes · ${formatNumber(professionals)} profissionais`,
      icon: Users,
    },
    {
      label: "Leads",
      value: formatNumber(leadsTotal),
      hint: `${formatNumber(leadsOpen)} abertos`,
      icon: Wrench,
    },
    {
      label: "Receita",
      value: formatBRL(revenue),
      hint: `${formatNumber(paidOrders)} pedidos pagos`,
      icon: CreditCard,
      accent: true,
    },
    {
      label: "Compras de leads",
      value: formatNumber(safeCount(m.lead_purchases)),
      hint: `${formatNumber(safeCount(m.credit_packages_sold))} pacotes vendidos`,
      icon: CreditCard,
    },
    {
      label: "Avaliações",
      value: formatNumber(safeCount(m.reviews)),
      icon: Star,
    },
    {
      label: "Conversas",
      value: formatNumber(safeCount(m.conversations)),
      icon: MessageSquare,
    },
  ];
}

export function MetricCards() {
  const { data, isLoading, isError, error } = useQuery<AdminMetrics>({
    queryKey: metricsKey,
    queryFn: fetchMetrics,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex h-28 items-center justify-center rounded-lg border bg-card"
          >
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        {adminErrorMessage(error, "Não foi possível carregar as métricas.")}
      </div>
    );
  }

  const metrics = buildMetrics(data);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {metrics.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="rounded-lg border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {item.label}
              </span>
              <span
                className={
                  item.accent
                    ? "flex h-9 w-9 items-center justify-center rounded-md bg-brand/10 text-brand"
                    : "flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary"
                }
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums">
              {item.value}
            </p>
            {item.hint ? (
              <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
