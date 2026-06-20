"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ClipboardList,
  Briefcase,
  MessageCircle,
  User,
  Plus,
  CreditCard,
  LayoutDashboard,
  Users,
  Activity,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import type { UserRole } from "@/types";

/**
 * `BottomNav` — barra de navegação fixa inferior, **só em mobile** (`lg:hidden`).
 *
 * 5 itens conforme o papel (`useAuth`), com FAB central laranja elevado.
 * Item ativo em azul (`text-primary`). Badge de não lidas opcional em
 * "Mensagens" via prop `unreadCount`.
 *
 * Não aparece deslogado (retorna `null` se não autenticado / não hidratado).
 */

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Item central elevado (FAB laranja). */
  fab?: boolean;
  /** Mostra badge de não lidas (Mensagens). */
  badge?: boolean;
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  customer: [
    { href: "/", label: "Início", icon: Home },
    { href: "/leads", label: "Solicitações", icon: ClipboardList },
    { href: "/leads/new", label: "Solicitar", icon: Plus, fab: true },
    { href: "/conversas", label: "Mensagens", icon: MessageCircle, badge: true },
    { href: "/profile", label: "Perfil", icon: User },
  ],
  professional: [
    { href: "/", label: "Início", icon: Home },
    { href: "/marketplace", label: "Oportunidades", icon: Briefcase },
    { href: "/credits", label: "Créditos", icon: Plus, fab: true },
    { href: "/conversas", label: "Mensagens", icon: MessageCircle, badge: true },
    { href: "/profile", label: "Perfil", icon: User },
  ],
  admin: [
    { href: "/admin", label: "Painel", icon: LayoutDashboard },
    { href: "/admin/usuarios", label: "Usuários", icon: Users },
    { href: "/admin/leads", label: "Leads", icon: ClipboardList },
    { href: "/admin/financeiro", label: "Financeiro", icon: CreditCard },
    { href: "/admin/monitoramento", label: "Monitor", icon: Activity },
    { href: "/profile", label: "Perfil", icon: User },
  ],
};

/** Considera ativo o item cuja rota casa exatamente ou é prefixo do path. */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface BottomNavProps {
  /** Total de mensagens não lidas (badge em "Mensagens"). */
  unreadCount?: number;
  className?: string;
}

export function BottomNav({ unreadCount = 0, className }: BottomNavProps) {
  const pathname = usePathname() ?? "";
  const { role, isAuthenticated, hasHydrated } = useAuth();

  if (!hasHydrated || !isAuthenticated || !role) return null;

  const items = NAV_BY_ROLE[role];

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card lg:hidden",
        className
      )}
    >
      <ul className="mx-auto flex h-16 max-w-6xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;

          if (item.fab) {
            return (
              <li key={item.href} className="flex items-center">
                <Link
                  href={item.href}
                  aria-label={item.label}
                  className="-mt-6 inline-flex h-14 w-14 flex-col items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg ring-4 ring-card transition-transform hover:scale-105 active:scale-95"
                >
                  <Icon className="h-6 w-6" aria-hidden />
                </Link>
              </li>
            );
          }

          return (
            <li key={item.href} className="flex flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" aria-hidden />
                  {item.badge && unreadCount > 0 ? (
                    <span className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-brand-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
