"use client";

/**
 * Painel administrativo — **dashboard** (`/admin`).
 *
 * Protegido para o papel `admin`. Mostra os KPIs (`MetricCards`) e atalhos
 * para as subpáginas de gestão. Apenas tokens do design system.
 */

import Link from "next/link";
import {
  Activity,
  ClipboardList,
  CreditCard,
  Gift,
  ScrollText,
  Tags,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useRequireAuth } from "@/hooks/use-auth";
import { MetricCards } from "@/modules/admin";

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
    description: "Gerencie contas e status (ativar, suspender, bloquear).",
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
];

export default function AdminDashboardPage() {
  const auth = useRequireAuth("admin");

  if (!auth.hasHydrated || !auth.isAuthenticated || !auth.isAdmin) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
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
            return (
              <Link
                key={shortcut.href}
                href={shortcut.href}
                className="group rounded-lg border bg-card p-5 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
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
