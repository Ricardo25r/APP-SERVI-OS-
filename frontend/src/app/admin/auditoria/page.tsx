"use client";

/**
 * Painel admin — **auditoria** (`/admin/auditoria`).
 *
 * Protegido para o papel `admin`. Lista (somente leitura) da trilha de
 * auditoria: ação, ator, entidade e data. Apenas tokens do design system.
 */

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { useRequireAuth } from "@/hooks/use-auth";
import { AuditList } from "@/modules/admin";

export default function AdminAuditPage() {
  const auth = useRequireAuth("admin");

  if (!auth.hasHydrated || !auth.isAuthenticated || !auth.isAdmin) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Painel
      </Link>

      <header className="mb-8 mt-2 space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Auditoria</h1>
        <p className="text-muted-foreground">
          Registro imutável das ações administrativas.
        </p>
      </header>

      <AuditList />
    </main>
  );
}
