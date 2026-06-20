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
import { Loader2 } from "lucide-react";

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

  // Antes da hidratação — ou enquanto redireciona p/ splash — loader centralizado
  // (evita a sensação de "tela branca" no refresh).
  if (!hasHydrated || !isAuthenticated || !user) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden />
          <span className="text-sm text-muted-foreground">Carregando...</span>
        </div>
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
