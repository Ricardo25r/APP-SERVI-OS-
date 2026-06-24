"use client";

/**
 * Painel administrativo — **dashboard** (`/admin`).
 *
 * Protegido para o papel `admin`. Mostra um aviso de chamados em aberto (quando
 * houver), os KPIs (`MetricCards`) e atalhos para as subpáginas de gestão.
 * Apenas tokens do design system.
 */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Flag,
  Gift,
  LifeBuoy,
  Map,
  Rocket,
  ScrollText,
  ShieldCheck,
  Tags,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useRequireAuth } from "@/hooks/use-auth";
import { fetchMetrics, MetricCards } from "@/modules/admin";
import { metricsKey } from "@/modules/admin/components/metric-cards";

interface Shortcut {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const SHORTCUTS: Shortcut[] = [
  {
    href: "/admin/usuarios",
    label: "Usuários",
    description: "Gerencie contas, status e papéis (inclui promover a admin).",
    icon: Users,
  },
  {
    href: "/admin/leads",
    label: "Leads",
    description: "Modere solicitações e cancele quando necessário.",
    icon: ClipboardList,
  },
  {
    href: "/admin/financeiro",
    label: "Financeiro",
    description: "Pedidos de pagamento e resumo de receita.",
    icon: CreditCard,
  },
  {
    href: "/admin/categorias",
    label: "Categorias",
    description: "Crie, edite e desative categorias de serviço.",
    icon: Tags,
  },
  {
    href: "/admin/creditos",
    label: "Conceder créditos",
    description: "Crédito de bônus para a carteira de um profissional.",
    icon: Gift,
  },
  {
    href: "/admin/auditoria",
    label: "Auditoria",
    description: "Trilha imutável das ações administrativas.",
    icon: ScrollText,
  },
  {
    href: "/admin/monitoramento",
    label: "Monitoramento",
    description: "Métricas, saúde do sistema e erros capturados (com traceback).",
    icon: Activity,
  },
  {
    href: "/admin/chamados",
    label: "Chamados",
    description: "Veja e responda os chamados de suporte dos usuários.",
    icon: LifeBuoy,
  },
  {
    href: "/admin/sprints",
    label: "Sprints",
    description: "Esteira de ideias: bugs, melhorias, consertos e ideias do produto.",
    icon: Rocket,
  },
  {
    href: "/admin/cobertura",
    label: "Cobertura",
    description: "Prestadores por categoria (quais têm e quais faltam) + média de idade.",
    icon: Map,
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    description: "Páginas mais acessadas, por aparelho, região e tipo de conta.",
    icon: BarChart3,
  },
  {
    href: "/admin/kyc",
    label: "Verificações",
    description: "Analise documentos + selfie dos profissionais (KYC).",
    icon: ShieldCheck,
  },
  {
    href: "/admin/denuncias",
    label: "Denúncias",
    description: "Analise denúncias de abuso enviadas pelos usuários.",
    icon: Flag,
  },
];

export default function AdminDashboardPage() {
  const auth = useRequireAuth("admin");

  const { data: metrics } = useQuery({
    queryKey: metricsKey,
    queryFn: fetchMetrics,
    enabled: auth.isAdmin,
  });
  const openTickets = metrics?.support_tickets_open ?? 0;

  if (!auth.hasHydrated || !auth.isAuthenticated || !auth.isAdmin) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Aviso de chamados em aberto */}
      {openTickets > 0 ? (
        <Link
          href="/admin/chamados"
          className="mb-6 flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-foreground transition-colors hover:bg-destructive/15"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-destructive text-destructive-foreground">
            <LifeBuoy className="h-5 w-5" aria-hidden />
          </span>
          <span className="flex-1">
            <strong className="font-semibold">
              {openTickets} chamado{openTickets > 1 ? "s" : ""} em aberto
            </strong>{" "}
            aguardando resposta.
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      ) : null}

      <header className="mb-8 space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Painel administrativo</h1>
        <p className="text-muted-foreground">
          Visão geral e gestão do FazTudo.
        </p>
      </header>

      <MetricCards />

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Atalhos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SHORTCUTS.map((shortcut) => {
            const Icon = shortcut.icon;
            const badge =
              shortcut.href === "/admin/chamados" && openTickets > 0
                ? openTickets
                : null;
            return (
              <Link
                key={shortcut.href}
                href={shortcut.href}
                className="group rounded-lg border bg-card p-5 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <div className="flex items-start justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  {badge !== null ? (
                    <span className="flex min-w-[1.5rem] items-center justify-center rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
                      {badge}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-3 font-semibold text-foreground">
                  {shortcut.label}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {shortcut.description}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
