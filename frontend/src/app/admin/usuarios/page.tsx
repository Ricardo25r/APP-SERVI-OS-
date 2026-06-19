"use client";

/**
 * Painel admin — **usuários** (`/admin/usuarios`).
 *
 * Protegido para o papel `admin`. Tabela de usuários com filtros (papel/status/
 * busca) e ações de status com confirmação. Apenas tokens do design system.
 */

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { useRequireAuth } from "@/hooks/use-auth";
import { UsersTable } from "@/modules/admin";

export default function AdminUsersPage() {
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
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Painel
      </Link>

      <header className="mb-8 mt-2 space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
        <p className="text-muted-foreground">
          Gerencie contas e o status de acesso dos usuários.
        </p>
      </header>

      <UsersTable />
    </main>
  );
}
