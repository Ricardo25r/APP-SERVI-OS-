/**
 * `AdminHome` — Home logada do admin.
 *
 * Saudação + atalhos para as áreas administrativas (painel, usuários, leads,
 * financeiro). Visual de dashboard com cards. Somente camada visual; usa as
 * rotas `/admin/*` já existentes.
 */
"use client";

import Link from "next/link";
import {
  Activity,
  LayoutDashboard,
  Users,
  ClipboardList,
  Wallet,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

import { SectionHeader } from "@/components/ui/section-header";
import { IconChip } from "@/components/ui/icon-chip";
import type { User } from "@/types";

interface Shortcut {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: "blue" | "orange" | "green";
}

const SHORTCUTS: Shortcut[] = [
  {
    href: "/admin",
    label: "Painel",
    description: "Visão geral e métricas da plataforma",
    icon: LayoutDashboard,
    color: "blue",
  },
  {
    href: "/admin/usuarios",
    label: "Usuários",
    description: "Gerencie contas e permissões",
    icon: Users,
    color: "orange",
  },
  {
    href: "/admin/leads",
    label: "Leads",
    description: "Modere e acompanhe solicitações",
    icon: ClipboardList,
    color: "green",
  },
  {
    href: "/admin/financeiro",
    label: "Financeiro",
    description: "Pagamentos, créditos e relatórios",
    icon: Wallet,
    color: "blue",
  },
  {
    href: "/admin/monitoramento",
    label: "Monitoramento",
    description: "Métricas, saúde e erros (com traceback)",
    icon: Activity,
    color: "orange",
  },
];

export function AdminHome({ user }: { user: User }) {
  const firstName = user.name?.trim().split(/\s+/)[0] ?? "";

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <section className="rounded-2xl bg-primary px-5 py-6 text-primary-foreground sm:px-8 sm:py-8">
        <p className="text-sm font-medium text-primary-foreground/80">
          Olá{firstName ? `, ${firstName}` : ""}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Painel administrativo
        </h1>
        <p className="mt-2 max-w-lg text-sm text-primary-foreground/80">
          Gerencie usuários, solicitações e finanças da plataforma FazTudo.
        </p>
      </section>

      <section className="py-8">
        <SectionHeader title="Atalhos" className="mb-4" />
        <div className="grid gap-3 sm:grid-cols-2">
          {SHORTCUTS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-secondary"
            >
              <IconChip icon={item.icon} color={item.color} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold tracking-tight">
                  {item.label}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
