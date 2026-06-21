"use client";

/**
 * Painel admin — **chamados de suporte** (`/admin/chamados`).
 *
 * Protegido para o papel `admin`. Lista os chamados (com autor) e permite
 * marcar como resolvido / reabrir + responder por e-mail. Só tokens do DS.
 */

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { useRequireAuth } from "@/hooks/use-auth";
import { AdminTicketsTable } from "@/modules/support/admin-tickets-table";

export default function AdminChamadosPage() {
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
        <h1 className="text-3xl font-bold tracking-tight">Chamados</h1>
        <p className="text-muted-foreground">
          Veja e responda os chamados de suporte dos usuários.
        </p>
      </header>

      <AdminTicketsTable />
    </main>
  );
}
