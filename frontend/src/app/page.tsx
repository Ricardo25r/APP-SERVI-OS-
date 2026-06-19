/**
 * Home (`/`) — despacha por estado de autenticação e papel.
 *
 * - Deslogado: `Landing` (herói + mascotes + busca + categorias + como
 *   funciona + CTA).
 * - Logado: home por papel (`CustomerHome`, `ProfessionalHome`, `AdminHome`).
 *
 * Usa `useAuth()` + `hasHydrated` para evitar flicker entre SSR e hidratação.
 * Esta página só compõe a camada visual — rotas/lógica/chamadas seguem as
 * existentes (módulos em `@/modules/home/*`).
 */
"use client";

import { useAuth } from "@/hooks/use-auth";
import { Landing } from "@/modules/home/landing";
import { CustomerHome } from "@/modules/home/customer-home";
import { ProfessionalHome } from "@/modules/home/professional-home";
import { AdminHome } from "@/modules/home/admin-home";

export default function HomePage() {
  const { user, role, isAuthenticated, hasHydrated } = useAuth();

  // Antes da hidratação, não decidimos entre landing e dashboard (evita flicker).
  if (!hasHydrated) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-4 w-72 animate-pulse rounded bg-muted" />
      </main>
    );
  }

  if (!isAuthenticated || !user) {
    return <Landing />;
  }

  if (role === "professional") {
    return <ProfessionalHome user={user} />;
  }

  if (role === "admin") {
    return <AdminHome user={user} />;
  }

  // customer (default).
  return <CustomerHome user={user} />;
}
