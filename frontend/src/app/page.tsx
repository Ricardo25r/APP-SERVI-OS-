/**
 * Home (`/`) — despacha por estado de autenticação e papel.
 *
 * - Deslogado: redireciona para a **Splash** (`/splash`), que conduz o fluxo de
 *   primeiro acesso (Splash → Onboarding → Login/Cadastro). É a "cara de app".
 *   A landing de marketing (`@/modules/home/landing`) segue disponível como
 *   componente, caso queira reusá-la em outra rota.
 * - Logado: home por papel (`CustomerHome`, `ProfessionalHome`, `AdminHome`).
 *
 * Usa `useAuth()` + `hasHydrated` para evitar flicker entre SSR e hidratação.
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/use-auth";
import { CustomerHome } from "@/modules/home/customer-home";
import { ProfessionalHome } from "@/modules/home/professional-home";
import { AdminHome } from "@/modules/home/admin-home";

export default function HomePage() {
  const router = useRouter();
  const { user, role, isAuthenticated, hasHydrated } = useAuth();

  // Deslogado: entra pelo fluxo do app (splash → onboarding → login).
  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.replace("/splash");
    }
  }, [hasHydrated, isAuthenticated, router]);

  // Antes da hidratação — ou enquanto redireciona p/ splash — placeholder neutro.
  if (!hasHydrated || !isAuthenticated || !user) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-4 w-72 animate-pulse rounded bg-muted" />
      </main>
    );
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
